// Pedestrian sprite atlas, drawn pixel by pixel in code (no external art). Owned by the pedestrian work.
// Each variant is a row of 16 cells of 24x48 px: 4 directions (front, back, left, right) x 4 poses
// (idle, step A, passing, step B). Right is the mirror of left. Feet stand on pixel row 46.
export const CELL_W = 24, CELL_H = 48, POSES = 4, DIRS = 4, COLS = POSES * DIRS;
export const FRONT = 0, BACK = 1, LEFT = 2, RIGHT = 3;
const FY = 46;

const hx = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const sh = (c, k) => { const [r, g, b] = hx(c); const f = v => Math.max(0, Math.min(255, Math.round(v * k))); return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join(''); };

// ---------- the cast ----------
// leg/tor/head are heights in px (adult 19/14/10), tw torso width. bottom.type: trousers | shorts | skirt | robe.
// the "falsi invalidi" gag: a tracksuit man in a wheelchair who leaps up and sprints off when the lapa comes near
const TRACK = { tw: 13, skin: '#c99872', hair: '#6b645c', hairStyle: 'short', glasses: '#18161a', top: '#b83a2c', sleeve: 'long', sleeveStripe: '#f0eee8', chain: '#d9b44a', bottom: { type: 'trousers', col: '#b83a2c', stripe: '#f0eee8' }, shoes: '#f0eee8' };
export const VARIANTS = [
  { id: 'nonna', leg: 17, tor: 14, head: 9, stoop: 1, h: 1.6, skin: '#d6a284', hair: '#bdb8b0', hat: { type: 'scarf', col: '#222025' }, top: '#2a2830', sleeve: 'long',
    bottom: { type: 'skirt', col: '#25232a', len: 12 }, legCol: '#2f2b33', shoes: '#18161a', bag: '#5d8a4a', speed: 0.85 },
  { id: 'coppola', hair: '#7a6a58', hat: { type: 'flatcap', col: '#6d6a5e' }, skin: '#cf9d78', top: '#c9d4e0', sleeve: 'short', bottom: { type: 'trousers', col: '#4a4640' }, shoes: '#3a2c24', belt: '#2a2018', speed: 1.1 },
  { id: 'vendor', skin: '#bf8a66', hair: '#1c1614', hairStyle: 'short', top: '#e9e4d6', sleeve: 'short', apron: '#b8382c', beard: '#1c1614', bottom: { type: 'trousers', col: '#3a4a63' }, shoes: '#2c2622', speed: 0.95 },
  { id: 'tourist', skin: '#e3b99a', hair: '#8a5a32', hat: { type: 'straw', col: '#d8c07a', col2: '#a8442c' }, top: '#3f9ab8', sleeve: 'short', bottom: { type: 'shorts', col: '#c8b78e', len: 8 },
    shoes: '#ece9e3', backpack: '#c0572b', glasses: '#1c1c20', speed: 1.0 },
  { id: 'kid', leg: 11, tor: 9, head: 9, hw: 10, tw: 10, h: 1.18, skin: '#d9a98a', hair: '#2a1c14', hairStyle: 'short', top: '#e0b42f', sleeve: 'short', bottom: { type: 'shorts', col: '#2f5f93', len: 4 }, shoes: '#eeeeee', speed: 1.5, bounce: true },
  { id: 'teen', skin: '#d6a07c', hair: '#1f1814', hairStyle: 'fringe', top: '#4a4f5a', sleeve: 'long', hood: true, bottom: { type: 'trousers', col: '#35527d' }, shoes: '#f0f0f0', phone: '#9fd8ff', speed: 1.25 },
  { id: 'priest', skin: '#d9ae8f', hair: '#8c8c8c', hairStyle: 'short', top: '#1b1a1f', sleeve: 'long', collar: '#f1efe8', bottom: { type: 'robe', col: '#1b1a1f' }, shoes: '#0f0f12', speed: 0.95 },
  { id: 'carabiniere', skin: '#d2a183', hair: '#2a2420', hat: { type: 'peaked', col: '#1e2745', col2: '#c8c8d0' }, top: '#212c4a', sleeve: 'long', bandolier: '#e8e6df', belt: '#e8e6df',
    bottom: { type: 'trousers', col: '#1c2540', stripe: '#b2262a' }, shoes: '#0e0e10', speed: 1.1 },
  { id: 'signora', skin: '#e0ae8c', hair: '#2a1a14', hairStyle: 'long', top: '#e6c34a', sleeve: 'short', glasses: '#18161a', bottom: { type: 'skirt', col: '#e6c34a', len: 9 }, legCol: '#e0ae8c', shoes: '#a8684a', purse: '#7a3a2a', speed: 1.1 },
  { id: 'suit', skin: '#d4a584', hair: '#2a2420', hairStyle: 'short', top: '#2f3441', sleeve: 'long', shirt: '#f0eee8', tie: '#a8302c', bottom: { type: 'trousers', col: '#2f3441' }, shoes: '#111114', briefcase: '#5b3a24', speed: 1.35 },
  { id: 'nonno', leg: 18, tor: 14, head: 10, stoop: 1, h: 1.68, skin: '#cc9a78', hair: '#dcd8d0', hairStyle: 'bald', top: '#7a8a62', shirt: '#e6e0d0', sleeve: 'long', bottom: { type: 'trousers', col: '#6a5a48' }, shoes: '#3a2a20', speed: 0.8 },
  { id: 'borsa', skin: '#cf9b78', hair: '#5a3a28', hairStyle: 'bun', top: '#c43c36', sleeve: 'short', bottom: { type: 'trousers', col: '#4b6a96' }, shoes: '#f0f0ee', tote: '#d9cfae', speed: 1.15 },
  { id: 'ragazzo', skin: '#d0a081', hair: '#1a1512', hairStyle: 'short', top: '#2f6b49', sleeve: 'short', collar: '#2f6b49', bottom: { type: 'trousers', col: '#c9b99a' }, shoes: '#6b4a30', speed: 1.2 },
  { id: 'fruttivendolo', tw: 14, h: 1.74, skin: '#c2916c', hair: '#6b645c', hairStyle: 'short', top: '#3f6bb0', sleeve: 'long', apron: '#2f6b49', hat: { type: 'flatcap', col: '#8a7a5a' }, bottom: { type: 'trousers', col: '#4a4034' }, shoes: '#2c2622', speed: 0.9 },
  { id: 'signora2', skin: '#d8a888', hair: '#8a6a3a', hairStyle: 'long', top: '#3f6bb0', sleeve: 'short', bottom: { type: 'skirt', col: '#3f6bb0', len: 10 }, legCol: '#d8a888', shoes: '#f0f0ee', purse: '#d9cfae', speed: 1.05 },
  { id: 'suit2', skin: '#c98e6a', hair: '#d0ccc4', hairStyle: 'bald', top: '#6b6f78', sleeve: 'long', shirt: '#cfe0f0', tie: '#2f4f7a', bottom: { type: 'trousers', col: '#6b6f78' }, shoes: '#1a1a1a', speed: 1.3 },
  { id: 'teen2', skin: '#e0b090', hair: '#c8a03a', hairStyle: 'long', top: '#f0eee8', sleeve: 'short', bottom: { type: 'trousers', col: '#2a2e38' }, shoes: '#c43c36', phone: '#9fd8ff', speed: 1.25 },
  { id: 'coppola2', skin: '#bf8a66', hair: '#9a9690', hat: { type: 'flatcap', col: '#3a3a40' }, top: '#6a7a58', sleeve: 'long', bottom: { type: 'trousers', col: '#33302c' }, shoes: '#2a2018', belt: '#2a2018', speed: 0.95 },
  { id: 'ragazzo2', skin: '#c99872', hair: '#2a1c14', hairStyle: 'short', top: '#3f6bb0', sleeve: 'short', bottom: { type: 'trousers', col: '#2a2e38' }, shoes: '#eeeeee', speed: 1.2 },
  { id: 'tourist2', skin: '#eec0a0', hair: '#d8b058', hairStyle: 'long', hat: { type: 'straw', col: '#e8dca8', col2: '#3f9ab8' }, top: '#d9443c', sleeve: 'short', glasses: '#1c1c20', bottom: { type: 'shorts', col: '#f0eee8', len: 8 }, shoes: '#a8684a', backpack: '#3a4a63', speed: 1.0 },
  { id: 'kid2', leg: 11, tor: 9, head: 9, tw: 10, skin: '#d9a98a', hair: '#4a2a1a', hairStyle: 'long', top: '#e87aa0', sleeve: 'short', bottom: { type: 'shorts', col: '#f0eee8', len: 4 }, shoes: '#c43c36', speed: 1.45, bounce: true },
  { id: 'vendor2', skin: '#cf9b78', hair: '#2a1a14', hairStyle: 'bun', top: '#b8382c', sleeve: 'short', apron: '#e9e4d6', bottom: { type: 'trousers', col: '#33302c' }, shoes: '#2c2622', speed: 0.95 },
  // ---- Palermo FC home-shirt fans: pink with black collar, sleeve trims and scarf (no crest, no sponsor)
  { id: 'tifoso', skin: '#d3a183', hair: '#1c1614', hairStyle: 'fade', top: '#f1a7c1', trim: '#17151a', collar: '#17151a', sleeve: 'short', scarf: ['#f1a7c1', '#17151a'], bottom: { type: 'trousers', col: '#2c3a55' }, shoes: '#eeeeee', speed: 1.2 },
  { id: 'tifoso2', tw: 14, skin: '#c99872', hair: '#1c1614', hairStyle: 'short', hat: { type: 'flatcap', col: '#17151a' }, top: '#f1a7c1', trim: '#17151a', collar: '#17151a', sleeve: 'short', chain: '#d9b44a', beard: '#1c1614', bottom: { type: 'shorts', col: '#17151a', len: 9 }, shoes: '#eeeeee', speed: 0.95 },
  { id: 'tifosa', skin: '#e0ae8c', hair: '#3a2418', hairStyle: 'bun', top: '#f1a7c1', trim: '#17151a', collar: '#17151a', sleeve: 'short', bottom: { type: 'trousers', col: '#35527d' }, shoes: '#eeeeee', glasses: '#17151a', speed: 1.15 },
  { id: 'tifoso_kid', leg: 11, tor: 9, head: 9, tw: 10, skin: '#d9a98a', hair: '#2a1c14', hairStyle: 'short', top: '#f1a7c1', trim: '#17151a', collar: '#17151a', sleeve: 'short', scarf: ['#f1a7c1', '#17151a'], bottom: { type: 'shorts', col: '#17151a', len: 4 }, shoes: '#eeeeee', speed: 1.5, bounce: true },
  { id: 'tifoso_nonno', tw: 14, stoop: 1, skin: '#c4906c', hair: '#d8d4cc', hairStyle: 'bald', top: '#f1a7c1', trim: '#17151a', collar: '#17151a', sleeve: 'short', belt: '#17151a', bottom: { type: 'trousers', col: '#2a2a30' }, shoes: '#3a2a20', speed: 0.85 },
  // ---- the street
  { id: 'tuta', skin: '#d3a183', hair: '#17120f', hairStyle: 'fade', top: '#1f2a48', sleeve: 'long', sleeveStripe: '#f0eee8', chain: '#d9b44a', bandolier: '#17151a', bottom: { type: 'trousers', col: '#1f2a48', stripe: '#f0eee8' }, shoes: '#f0eee8', speed: 1.3 },
  { id: 'skinny', tw: 11, skin: '#c99872', hair: '#17120f', hairStyle: 'quiff', top: '#ecebe6', sleeve: 'short', chain: '#d9b44a', bandolier: '#3a2a20', bottom: { type: 'trousers', col: '#26324a' }, shoes: '#f0eee8', speed: 1.3 },
  { id: 'motorino', skin: '#d0a081', hair: '#2a1c14', hat: { type: 'helmet', col: '#f0eee8' }, glasses: '#18161a', top: '#d9d4c6', sleeve: 'short', bottom: { type: 'shorts', col: '#3a4a63', len: 9 }, shoes: '#6b4a30', speed: 1.2 },
  { id: 'motorina', skin: '#d9a98a', hair: '#2a1a14', hairStyle: 'long', top: '#4fa9a0', sleeve: 'short', bigGlasses: '#18161a', helmetHand: '#f0eee8', bottom: { type: 'trousers', col: '#26324a' }, shoes: '#eeeeee', speed: 1.25 },
  { id: 'nonno_gilet', stoop: 1, skin: '#c4906c', hair: '#c8c4bc', hat: { type: 'flatcap', col: '#7a6a58' }, top: '#e6e0d0', vest: '#4a4a42', sleeve: 'long', belt: '#2a2018', bottom: { type: 'trousers', col: '#5a5044' }, shoes: '#3a2a20', speed: 0.8 },
  { id: 'nonna2', leg: 17, tor: 14, head: 9, stoop: 1, skin: '#d6a284', hair: '#a8452a', hairStyle: 'short', bigGlasses: '#18161a', top: '#2a2830', sleeve: 'long', bottom: { type: 'skirt', col: '#3a2f4a', len: 12 }, legCol: '#2f2b33', shoes: '#18161a', purse: '#3a2a20', speed: 0.85 },
  { id: 'nonna3', leg: 17, tor: 14, head: 9, stoop: 1, skin: '#cf9d7c', hair: '#dcd8d0', hairStyle: 'bun', top: '#2d3a55', sleeve: 'long', bottom: { type: 'skirt', col: '#2d3a55', len: 13 }, legCol: '#2f2b33', shoes: '#18161a', bag: '#c8c4b8', speed: 0.8 },
  { id: 'pescivendolo', tw: 13, skin: '#c2916c', hair: '#17120f', hairStyle: 'fade', beard: '#17120f', top: '#2f4a75', sleeve: 'short', apron: '#a9cde0', boots: '#f0eee8', bottom: { type: 'trousers', col: '#2a2e38' }, shoes: '#d8d6d0', speed: 1.0 },
  { id: 'macellaio', tw: 13, skin: '#cf9d7c', hair: '#17120f', hairStyle: 'short', top: '#ecebe6', sleeve: 'long', stain: '#9a2424', bottom: { type: 'trousers', col: '#2a2e38' }, shoes: '#2c2622', speed: 0.9 },
  { id: 'shopper', skin: '#d9a98a', hair: '#d4a050', hairStyle: 'long', bigGlasses: '#18161a', top: '#e0a83a', sleeve: 'short', bag: '#c43c36', bag2: '#2f6b49', bottom: { type: 'trousers', col: '#f0eee8' }, shoes: '#c8a070', speed: 1.1 },
  { id: 'beach_m', skin: '#b8744c', hair: '#17120f', hairStyle: 'short', glasses: '#18161a', top: '#b8744c', sleeve: 'short', scarf: ['#f0eee8', '#d9443c'], bottom: { type: 'shorts', col: '#2fa3c8', len: 10 }, shoes: '#2f8fd0', speed: 1.0 },
  { id: 'beach_w', skin: '#d9a98a', hair: '#4a2a1a', hairStyle: 'long', hat: { type: 'straw', col: '#e8dca8', col2: '#d9443c' }, glasses: '#18161a', top: '#f0eee8', sleeve: 'short', tote: '#e0c070', bottom: { type: 'skirt', col: '#2fa3c8', len: 9 }, legCol: '#d9a98a', shoes: '#e8553c', speed: 1.0 },
  { id: 'mamma', skin: '#d6a07c', hair: '#2a1a14', hairStyle: 'bun', top: '#6aa0c8', sleeve: 'short', stroller: ['#2a3f6b', '#3a4a63'], bottom: { type: 'trousers', col: '#35527d' }, shoes: '#eeeeee', speed: 0.9 },
  { id: 'scuola', leg: 11, tor: 9, head: 9, tw: 10, skin: '#d9a98a', hair: '#2a1c14', hairStyle: 'short', top: '#2a3f6b', collar: '#f0eee8', sleeve: 'long', backpack: '#c43c36', bottom: { type: 'trousers', col: '#2a2e38' }, shoes: '#eeeeee', speed: 1.4, bounce: true },
  { id: 'suora', skin: '#d9ae8f', hair: '#8c8c8c', hat: { type: 'scarf', col: '#2a2a30', col2: '#f0eee8' }, top: '#4a5260', collar: '#f0eee8', sleeve: 'long', bottom: { type: 'robe', col: '#4a5260' }, shoes: '#18181c', speed: 0.95 },
  { id: 'vigile', skin: '#d2a183', hair: '#2a2420', hat: { type: 'peaked', col: '#e8e6df', col2: '#b0903a' }, top: '#9fc4e0', sleeve: 'short', belt: '#2a2420', bottom: { type: 'trousers', col: '#1e2745' }, shoes: '#0e0e10', speed: 1.05 },
  { id: 'cameriere', skin: '#cf9b78', hair: '#17120f', hairStyle: 'fade', top: '#f0eee8', vest: '#17151a', sleeve: 'long', apron: '#f4f2ec', bottom: { type: 'trousers', col: '#17151a' }, shoes: '#17151a', speed: 1.2 },
  { id: 'wheelchair', ...TRACK, leg: 14, chair: true, speed: 1.0 },
  { id: 'healed', ...TRACK, run: true, speed: 2.6 },
  { id: 'chair_empty', chair: 'empty', leg: 14, top: '#000', skin: '#000', hair: '#000', bottom: { type: 'trousers', col: '#2c3a55' }, shoes: '#000' },
];
// Crowd weights per zone: [vicoli, main street, market, tourist, match-day / Libertà-Politeama]
const W = {
  nonna: [6, 3, 8, 1.5, 2], coppola: [6, 4, 6, 2, 2], vendor: [0.5, 1, 9, 0.5, 0.3], tourist: [2, 6, 2, 12, 2], kid: [4, 3, 4, 3, 2], teen: [5, 6, 4, 4, 4], priest: [1, 1, 0.5, 3, 0.3],
  carabiniere: [0.6, 1.2, 0.5, 2, 1.5], signora: [3, 3, 3, 3, 3], suit: [3, 5, 1, 3, 3], nonno: [5, 2, 6, 2, 1], borsa: [5, 6, 6, 5, 4], ragazzo: [4, 5, 3, 4, 4], fruttivendolo: [0.5, 0.5, 7, 0.2, 0],
  signora2: [3, 3, 3, 3, 3], suit2: [1.5, 3, 0.5, 1.5, 2], teen2: [3, 4, 2, 3, 3], coppola2: [5, 3, 4, 1, 1], ragazzo2: [3, 4, 3, 3, 3], tourist2: [2, 5, 1, 10, 2], kid2: [3, 3, 3, 3, 2], vendor2: [0.5, 1, 8, 0.5, 0.3],
  tifoso: [4, 5, 2, 3, 14], tifoso2: [3, 4, 2, 2, 12], tifosa: [3, 4, 1, 2, 10], tifoso_kid: [2, 2, 1, 1, 6], tifoso_nonno: [1.5, 1.5, 1.5, 0.5, 5],
  tuta: [5, 4, 3, 2, 3], skinny: [4, 5, 3, 3, 3], motorino: [3, 2, 3, 1, 2], motorina: [2, 2, 2, 1, 2], nonno_gilet: [5, 2, 5, 1, 1], nonna2: [6, 3, 7, 1, 1.5], nonna3: [5, 2, 5, 1, 1],
  pescivendolo: [0.5, 0, 8, 0, 0], macellaio: [0.3, 0, 4, 0, 0], shopper: [2, 5, 3, 3, 3], beach_m: [0.5, 1.5, 0.5, 3, 0.5], beach_w: [0.5, 1.5, 0.5, 3, 0.5], mamma: [3, 3, 2, 2, 2],
  wheelchair: [0.5, 1.2, 2, 0.8, 0.3], healed: [0, 0, 0, 0, 0], chair_empty: [0, 0, 0, 0, 0],
  scuola: [2, 1, 1, 1, 1], suora: [1, 1, 0.3, 3, 0.2], vigile: [0.5, 1.5, 0.5, 1.5, 1.5], cameriere: [1, 3, 1, 3, 1],
};
VARIANTS.forEach(v => { v.w = W[v.id] || [1, 1, 1, 1, 1]; });
export const ROWS = VARIANTS.length;

// ---------- drawing ----------
function figure(g, v, dir, pose) {
  const leg = v.leg || 19, tor = v.tor || 14, head = v.head || 10, tw = v.tw || 12, hw = v.hw || 10;
  const sw = pose === 1 ? 1 : pose === 3 ? -1 : 0, bob = pose === 2 ? -1 : 0;
  const hipY = FY - leg, shY = hipY - tor + bob, headTop = shY - 1 - head;
  const skin = v.skin, hair = v.hair, skinD = sh(skin, 0.82);
  const B = v.bottom, top = v.top, topD = sh(top, 0.8), stoop = v.stoop || 0;
  const P = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const bounceUp = v.bounce && pose === 2 ? -1 : 0;
  const isRobe = B.type === 'robe', isSkirt = B.type === 'skirt', isShorts = B.type === 'shorts';
  const legCol = isSkirt || isRobe ? (v.legCol || skin) : isShorts ? skin : B.col;
  const hemY = isRobe ? FY - 3 : isSkirt ? hipY + B.len : 0;
  const x0 = 12 - (tw >> 1), x1 = x0 + tw - 1;       // torso columns
  const armH = Math.min(13, tor - 1);

  if (dir === FRONT || dir === BACK) {
    const back = dir === BACK;
    // legs: forward leg reaches the ground, the other lifts its foot
    const hop = v.run ? 5 : 2, air = v.run && pose === 2 ? 4 : 0;
    const lb = (sw === 1 ? FY : sw === -1 ? FY - hop : FY) - air, rb = (sw === -1 ? FY : sw === 1 ? FY - hop : FY) - air;
    const legs = [[12 - 5, lb], [12, rb]];
    for (const [lx, bot] of legs) {
      P(lx, hipY, 5, bot - hipY, legCol);
      if (isShorts) P(lx, hipY, 5, B.len, B.col);
      if (B.stripe) P(lx + (lx < 12 ? 0 : 4), hipY + 2, 1, bot - hipY - 4, B.stripe);
      if (v.boots) P(lx - (lx < 12 ? 1 : 0), bot - 9, 6, 9, v.boots);
      P(lx - (lx < 12 ? 1 : 0), bot - 2, 6, 2, v.shoes);
    }
    P(11, hipY + 4, 1, FY - hipY - 6, sh(legCol, 0.6));
    if (isSkirt || isRobe) { // garment over the legs, hem swaying a little
      const sway = sw;
      for (let y = hipY; y < hemY; y++) { const t = (y - hipY) / Math.max(1, hemY - hipY), ex = Math.round(t * (isRobe ? 2 : 1.5)); P(x0 - ex + (sway && y > hemY - 3 ? sway : 0), y, tw + ex * 2, 1, B.col); }
      if (isRobe) { P(12, hipY + 1, 1, hemY - hipY - 1, sh(B.col, 1.9)); }
    }
    // torso
    P(x0, shY, tw, tor, back && v.vest ? v.vest : top); g.clearRect(x0, shY, 1, 1); g.clearRect(x1, shY, 1, 1);
    if (v.vest && !back) { P(x0, shY, 3, tor, v.vest); P(x1 - 2, shY, 3, tor, v.vest); }
    if (v.stain) { P(x0 + 2, shY + 4, 3, 2, v.stain); P(x1 - 4, shY + 8, 2, 3, v.stain); }
    if (v.scarf) { P(x0 + 1, shY, tw - 2, 2, v.scarf[1]); P(x0 + 1, shY + 1, tw - 2, 1, v.scarf[0]); if (!back) for (let k = 0; k < 5; k++) P(10, shY + 2 + k * 2, 3, 2, v.scarf[k & 1 ? 1 : 0]); }
    if (v.chain && !back) P(10, shY + 1, 4, 1, v.chain);
    if (v.shirt && !back) { P(10, shY, 4, 5, v.shirt); if (v.tie) P(12, shY + 1, 1, 6, v.tie); }
    if (v.collar && !back) { P(10, shY, 4, 2, v.collar === '#2f6b49' ? skin : v.collar); }
    else if (!back && !v.hood && !v.shirt) P(10, shY, 4, 1, skinD);
    if (v.hood) { P(x0 + 1, shY, tw - 2, 2, sh(top, 0.7)); if (!back) P(12, shY + 2, 1, 5, sh(top, 1.6)); }
    if (v.belt) P(x0, hipY - 1, tw, 1, v.belt);
    if (v.bandolier) for (let i = 0; i < 9; i++) P(x0 + 1 + i * (back ? 1 : 1), shY + i, 2, 1, v.bandolier);
    if (v.apron && !back) { P(x0 + 1, shY + 3, tw - 2, hipY - shY + 9, v.apron); P(x0 + 3, shY + 1, tw - 6, 2, v.apron); P(x0 + 2, shY + 8, tw - 4, 1, sh(v.apron, 0.8)); }
    if (v.apron && back) P(x0, hipY - 3, tw, 1, sh(v.apron, 0.8));
    if (v.backpack) { if (back) { P(x0 + 1, shY + 1, tw - 2, tor - 3, v.backpack); P(x0 + 3, shY + 3, tw - 6, 3, sh(v.backpack, 0.75)); } else { P(x0 + 1, shY, 2, 8, sh(v.backpack, 0.7)); P(x1 - 2, shY, 2, 8, sh(v.backpack, 0.7)); } }
    if (v.tote && !back) P(x0 + 1, shY, 1, hipY - shY, sh(v.tote, 0.8));
    // arms
    const aL = sw === 1 ? 1 : 0, aR = sw === -1 ? 1 : 0; // the arm opposite the forward leg swings back (shorter)
    const arm = (ax, short, side) => {
      const len = armH - short;
      if (v.run) { // arms thrown up and pumping
        const up = (side < 0 ? sw : -sw) * 2, bx = ax + (side < 0 ? -1 : 1);
        P(bx, shY - 7 - up, 3, 9, top); if (v.sleeveStripe) P(bx + (side < 0 ? 0 : 2), shY - 7 - up, 1, 8, v.sleeveStripe); P(bx, shY - 9 - up, 3, 2, skin); return;
      }
      if (v.sleeve === 'short') { P(ax, shY + 1, 3, 5, top); if (v.trim) P(ax, shY + 5, 3, 1, v.trim); P(ax, shY + 6, 3, len - 5, skin); }
      else { P(ax, shY + 1, 3, len - 2, top); P(ax, shY + len - 1, 3, 2, skin); if (v.hood) P(ax, shY + len - 3, 3, 1, topD); }
      P(ax + (side < 0 ? 2 : 0), shY + 1, 1, len - 1, sh(top, 0.82));
      if (v.sleeveStripe) P(ax + (side < 0 ? 0 : 2), shY + 1, 1, len - 3, v.sleeveStripe);
    };
    const aLx = x0 - 3, aRx = x1 + 1;
    const phone = v.phone && !back;
    if (phone) { // right hand (screen left) holds a phone up to the face
      P(aLx, shY + 1, 3, 5, top); P(aLx + 1, shY + 5, 3, 3, top); P(aLx + 2, shY + 3, 2, 2, topD); P(aLx + 3, shY + 1, 2, 4, skin);
      P(aLx + 3, headTop + head - 5, 3, 5, '#202026'); P(aLx + 4, headTop + head - 4, 1, 3, v.phone);
    } else arm(aLx, aL, -1);
    arm(aRx, aR, 1);
    if (v.briefcase) { P(aRx - 1, shY + armH, 5, 5, v.briefcase); P(aRx, shY + armH - 1, 3, 1, sh(v.briefcase, 0.6)); }
    if (v.bag) { P(aLx - 1, shY + armH - 1, 5, 7, v.bag); P(aLx, shY + armH - 2, 3, 1, sh(v.bag, 0.6)); P(aLx + 1, shY + armH + 1, 2, 3, sh(v.bag, 1.3)); }
    if (v.tote) { P(aLx - 1, shY + armH - 1, 5, 8, v.tote); P(aLx, shY + armH - 2, 3, 1, sh(v.tote, 0.6)); P(aLx + 1, shY + armH + 1, 3, 1, '#a8442c'); }
    if (v.purse) { P(aRx, shY + armH - 1, 4, 4, v.purse); }
    if (v.bag2) { P(aRx, shY + armH - 1, 5, 7, v.bag2); P(aRx + 1, shY + armH - 2, 3, 1, sh(v.bag2, 0.6)); P(aRx + 1, shY + armH + 1, 2, 3, sh(v.bag2, 1.3)); }
    if (v.helmetHand) { P(aRx - 1, shY + armH, 5, 4, v.helmetHand); P(aRx, shY + armH, 3, 1, sh(v.helmetHand, 1.1)); P(aRx - 1, shY + armH + 3, 5, 1, '#202026'); }
    if (v.stroller) { const [c1, c2] = v.stroller; if (back) { P(x0 + 1, hipY + 1, tw - 2, 2, '#26262c'); } else { P(7, hipY + 2, 10, 4, c1); P(7, hipY + 6, 10, 1, sh(c1, 0.7)); P(8, hipY + 7, 8, FY - hipY - 10, c2); P(7, FY - 4, 3, 4, '#1c1c20'); P(14, FY - 4, 3, 4, '#1c1c20'); } }
    // head
    const hx0 = 12 - (hw >> 1);
    P(hx0, headTop, hw, head, skin); g.clearRect(hx0, headTop, 1, 1); g.clearRect(hx0 + hw - 1, headTop, 1, 1);
    P(hx0 + 1, headTop + head - 2, hw - 2, 2, sh(skin, 0.94)); P(10, shY - 1, 4, 1, skinD);
    const hs = v.hairStyle || 'short', fadeC = sh(skin, 0.62), sideC = hs === 'fade' ? fadeC : hair;
    if (back) { // hair covers the back of the head
      P(hx0, headTop, hw, hs === 'bald' ? 4 : hs === 'fade' ? 4 : head - 2, hair); if (hs === 'fade') P(hx0, headTop + 4, hw, 3, fadeC);
      if (hs === 'quiff') P(hx0 + 2, headTop - 1, hw - 4, 1, hair); if (hs === 'long') P(hx0, headTop, hw, head + 4, hair);
      if (hs === 'bun') P(10, headTop - 2, 4, 3, hair);
      if (hs === 'bald') { P(hx0, headTop + 3, 2, 4, hair); P(hx0 + hw - 2, headTop + 3, 2, 4, hair); }
    } else {
      const fr = hs === 'fringe' ? 4 : hs === 'bald' ? 0 : 3;
      if (hs !== 'bald') P(hx0, headTop, hw, fr, hair); else { P(hx0, headTop + 2, 2, 4, hair); P(hx0 + hw - 2, headTop + 2, 2, 4, hair); P(hx0 + 2, headTop, hw - 4, 1, sh(skin, 1.12)); }
      if (hs !== 'bald') { P(hx0, headTop, 1, 6, sideC); P(hx0 + hw - 1, headTop, 1, 6, sideC); }
      if (hs === 'quiff' || hs === 'fade') { P(hx0 + 2, headTop - (hs === 'quiff' ? 1 : 0), hw - 4, 1, hair); P(hx0 + 3, headTop, 3, 1, sh(hair, 2.4)); }
      if (hs === 'long') { P(hx0 - 1, headTop + 2, 2, head + 3, hair); P(hx0 + hw - 1, headTop + 2, 2, head + 3, hair); }
      if (hs === 'bun') P(10, headTop - 2, 4, 3, hair);
      const ey = headTop + Math.round(head * 0.55);
      if (v.bigGlasses) { P(hx0, ey - 1, 5, 3, v.bigGlasses); P(hx0 + hw - 5, ey - 1, 5, 3, v.bigGlasses); P(hx0 + 5, ey - 1, hw - 10, 1, v.bigGlasses); }
      else if (v.glasses) { P(hx0 + 1, ey, hw - 2, 2, v.glasses); } else { P(hx0 + 2, ey, 2, 2, '#1a1414'); P(hx0 + hw - 4, ey, 2, 2, '#1a1414'); }
      P(11, ey + 2, 2, 1, skinD); // nose shadow
      P(10, ey + 4, 4, 1, v.beard ? v.beard : sh(skin, 0.7));
      if (v.beard) { P(hx0, ey + 3, hw, head - (ey - headTop) - 3, v.beard); P(10, ey + 4, 4, 1, sh(skin, 0.8)); }
    }
    hats(g, v, dir, hx0, hw, headTop, head, P, back);
  } else {
    // side view, facing left; the right view is mirrored afterwards
    const hipX = 11, torW = Math.max(6, Math.round(tw * 0.62));
    const tx0 = hipX - (torW >> 1) - 1, tx1 = tx0 + torW - 1;
    const swing = v.run ? 6 : v.bounce ? 3 : 4;
    const near = (sw === 0 ? 0 : sw), fx = hipX - swing * near;     // near foot x (forward = -x)
    const limbs = (fxn, lift, c, shoe, dark) => {
      const cc = dark ? sh(c, 0.75) : c;
      limb(P, hipX, hipY, fxn, FY - lift, 4, cc);
      if (isShorts) limb(P, hipX, hipY, hipX + (fxn - hipX) * B.len / leg, hipY + B.len, 4, dark ? sh(B.col, 0.75) : B.col);
      if (v.boots) P(fxn - 2, FY - lift - 9, 5, 9, dark ? sh(v.boots, 0.75) : v.boots);
      P(fxn - 2, FY - lift - 2, 5, 2, dark ? sh(shoe, 0.75) : shoe);
    };
    if (v.stroller) { const [c1, c2] = v.stroller; P(1, hipY + 5, 9, 6, c2); P(0, hipY + 2, 7, 4, c1); P(1, hipY + 2, 6, 1, sh(c1, 1.3)); P(7, hipY + 1, 5, 1, '#26262c'); P(9, hipY + 1, 1, 6, '#26262c'); P(1, FY - 4, 4, 4, '#1c1c20'); P(7, FY - 4, 4, 4, '#1c1c20'); P(2, FY - 3, 2, 2, '#8a8a90'); P(8, FY - 3, 2, 2, '#8a8a90'); }
    // far leg first
    limbs(2 * hipX - fx, v.run ? 3 : sw === 0 ? 0 : 1, legCol, v.shoes, true);
    // far arm (behind torso)
    const armHandN = hipX + (v.run ? 8 : 3) * near; // near arm goes back when the near leg is forward
    const sideArm = (hxn, dark) => {
      const c = dark ? sh(top, 0.7) : top;
      const hy = v.run ? armH - 6 : armH - 1;
      limb(P, hipX, shY + 2, hxn, shY + hy, 3, v.sleeve === 'short' ? c : c);
      if (v.sleeve === 'short') limb(P, hxn - (hxn - hipX) * 0.35, shY + 6, hxn, shY + hy, 3, dark ? sh(skin, 0.75) : skin);
      P(hxn - 1, shY + hy, 3, 2, dark ? sh(skin, 0.75) : skin);
    };
    sideArm(2 * hipX - armHandN, true);
    if (v.backpack) { P(tx1 + 1, shY + 1, 4, tor - 3, v.backpack); P(tx1 + 2, shY + 3, 2, 3, sh(v.backpack, 0.75)); }
    if (v.hood) P(tx1, shY - 1, 3, 4, sh(top, 0.7));
    if (isSkirt || isRobe) {
      for (let y = hipY; y < hemY; y++) { const t = (y - hipY) / Math.max(1, hemY - hipY), ex = Math.round(t * (isRobe ? 3 : 2)); P(tx0 - ex + (y > hemY - 3 ? -sw : 0), y, torW + ex * 2, 1, B.col); }
    }
    // near leg over the garment hem
    limbs(fx, v.run && sw === 0 ? 3 : 0, legCol, v.shoes, false);
    if (isSkirt || isRobe) { for (let y = hipY; y < Math.min(hemY, hipY + 5); y++) P(tx0 - 1, y, torW + 2, 1, B.col); }
    // torso
    P(tx0, shY, torW, tor, v.vest || top); g.clearRect(tx0, shY, 1, 1);
    if (v.stain) { P(tx0 + 2, shY + 4, 2, 2, v.stain); P(tx0 + 1, shY + 9, 3, 2, v.stain); }
    if (v.scarf) { P(tx0, shY, torW, 2, v.scarf[0]); for (let k = 0; k < 4; k++) P(tx0 - 1, shY + 2 + k * 2, 2, 2, v.scarf[k & 1 ? 0 : 1]); }
    if (v.chain) P(tx0, shY + 1, 1, 1, v.chain);
    if (v.shirt) P(tx0, shY, 1, 6, v.shirt);
    if (v.collar && v.collar !== v.top && v.collar !== '#2f6b49') P(tx0, shY, 2, 2, v.collar);
    if (v.belt) P(tx0, hipY - 1, torW, 1, v.belt);
    if (v.bandolier) for (let i = 0; i < 9; i++) P(tx0 + (i >> 1), shY + i, 2, 1, v.bandolier);
    if (v.apron) { P(tx0 - 1, shY + 3, 2, hipY - shY + 9, v.apron); P(tx0 - 1, shY + 3, 1, hipY - shY + 9, sh(v.apron, 1.15)); }
    if (v.tote) P(tx0 + 2, shY, 1, 5, sh(v.tote, 0.8));
    // head (profile)
    const hx0 = hipX - 3 - stoop, hwid = hw - 1;
    P(hx0, headTop, hwid, head, skin); g.clearRect(hx0, headTop, 1, 1); g.clearRect(hx0 + hwid - 1, headTop, 1, 1);
    P(hx0 - 1, headTop + Math.round(head * 0.5), 1, 2, skin); // nose
    P(hx0 + hwid - 3, headTop + Math.round(head * 0.45), 2, 3, skinD); // ear
    const hs = v.hairStyle || 'short', ey = headTop + Math.round(head * 0.5);
    if (hs === 'bald') { P(hx0 + hwid - 3, headTop + 2, 3, 5, hair); P(hx0 + 1, headTop, hwid - 2, 1, sh(skin, 1.12)); }
    else {
      P(hx0 + 1, headTop, hwid - 1, 3, hair); P(hx0 + hwid - 4, headTop, 4, head - 3, hair);
      if (hs === 'fringe') P(hx0, headTop, 3, 5, hair);
      if (hs === 'quiff') { P(hx0, headTop - 1, hwid - 3, 1, hair); P(hx0 + 1, headTop - 1, 2, 1, sh(hair, 2.4)); }
      if (hs === 'fade') { P(hx0 + hwid - 4, headTop + 3, 4, 4, sh(skin, 0.62)); P(hx0 + 1, headTop, 3, 1, sh(hair, 2.4)); }
      if (hs === 'long') P(hx0 + hwid - 5, headTop, 5, head + 5, hair);
      if (hs === 'bun') P(hx0 + hwid - 2, headTop - 1, 4, 4, hair);
    }
    P(hx0 + 1, ey, 1, 2, v.glasses || '#1a1414'); if (v.glasses) P(hx0 + 1, ey, 3, 2, v.glasses); if (v.bigGlasses) P(hx0, ey - 1, 4, 3, v.bigGlasses);
    if (v.beard) P(hx0, ey + 2, 4, 3, v.beard);
    P(hx0, ey + 4, 2, 1, sh(skin, 0.7));
    hats(g, v, dir, hx0, hwid, headTop, head, P, false);
    // near arm in front of the torso
    if (v.phone) { limb(P, hipX, shY + 2, hipX - 4, shY + 7, 3, top); P(hipX - 5, shY + 1, 3, 4, skin); P(hx0 - 3, ey + 1, 3, 4, '#202026'); P(hx0 - 3, ey + 2, 1, 2, v.phone); P(hx0 - 2, shY - 1, 1, 1, skinD); }
    else sideArm(armHandN, false);
    if (v.bag) { const bx = armHandN - 2; P(bx, shY + armH, 6, 7, v.bag); P(bx + 1, shY + armH - 1, 4, 1, sh(v.bag, 0.6)); P(bx + 2, shY + armH + 2, 2, 3, sh(v.bag, 1.3)); }
    if (v.tote) { const bx = armHandN - 3; P(bx, shY + armH - 1, 7, 8, v.tote); P(bx + 1, shY + armH - 2, 5, 1, sh(v.tote, 0.6)); P(bx + 1, shY + armH + 2, 4, 1, '#a8442c'); }
    if (v.briefcase) { const bx = armHandN - 3; P(bx, shY + armH, 7, 5, v.briefcase); P(bx + 2, shY + armH - 1, 3, 1, sh(v.briefcase, 0.6)); }
    if (v.purse) P(tx1 - 1, hipY - 1, 4, 5, v.purse);
    if (v.bag2) { const bx = armHandN + 2; P(bx, shY + armH, 5, 6, v.bag2); P(bx + 1, shY + armH - 1, 3, 1, sh(v.bag2, 0.6)); }
    if (v.helmetHand) { const bx = armHandN - 3; P(bx, shY + armH, 6, 4, v.helmetHand); P(bx, shY + armH + 3, 6, 1, '#202026'); }
  }
}

// Wheelchair: wheels turn with the pose (spokes rotate in profile, dashes run along the rim head-on).
function chairParts(g, v, dir, pose) {
  const P = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const empty = v.chair === 'empty', HY = FY - 14, dark = '#2e2e34', frame = '#4a4a52', cush = '#2f3f6a';
  const B = v.bottom, hipX = 11, torW = Math.max(6, Math.round((v.tw || 12) * 0.62)), shY = HY - (v.tor || 14);
  const wheelSide = (cx, cy, r) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.hypot(x, y); if (d >= r - 1 && d <= r + 0.5) P(cx + x, cy + y, 1, 1, d >= r - 0.4 ? '#222226' : '#9a9aa2'); }
    for (let k = 0; k < 4; k++) { const a = pose * 0.5 + k * Math.PI / 2; for (let t = 1; t < r - 1; t++) P(Math.round(cx + Math.cos(a) * t), Math.round(cy + Math.sin(a) * t), 1, 1, '#6c6c74'); }
    P(cx - 1, cy - 1, 2, 2, '#c8c8d0');
  };
  const wheelFront = x => { for (let y = FY - 17; y < FY; y++) P(x, y, 2, 1, ((y + pose * 2) % 6) < 3 ? '#9a9aa2' : '#222226'); };
  if (dir === FRONT || dir === BACK) {
    wheelFront(1); wheelFront(21);
    if (empty) {
      P(7, FY - 30, 10, 18, dark); P(4, FY - 20, 2, 5, frame); P(18, FY - 20, 2, 5, frame); P(6, FY - 15, 12, 3, cush);
      P(7, FY - 12, 2, 9, frame); P(15, FY - 12, 2, 9, frame); if (dir === FRONT) P(7, FY - 3, 10, 2, '#3a3a40');
    } else if (dir === BACK) { P(7, shY + 4, 10, 10, dark); P(5, shY + 2, 2, 3, dark); P(17, shY + 2, 2, 3, dark); }
    else { P(4, HY + 1, 3, 2, frame); P(17, HY + 1, 3, 2, frame); }
  } else {
    if (!empty) {
      g.clearRect(0, HY, 24, 48 - HY);
      P(hipX - 9, HY - 1, 11, 4, B.col); P(hipX - 9, HY + 3, 4, 8, B.col); P(hipX - 11, FY - 4, 6, 2, v.shoes); P(hipX - 11, FY - 2, 6, 1, '#3a3a40');
      P(hipX + 4, shY + 3, 2, HY - shY + 4, dark); P(hipX + 5, shY + 2, 4, 1, dark); P(hipX - 8, HY + 3, 12, 1, dark);
    } else {
      P(hipX + 4, FY - 32, 2, 20, dark); P(hipX + 5, FY - 32, 4, 1, dark); P(hipX - 7, FY - 15, 12, 3, cush); P(hipX - 8, FY - 12, 2, 10, frame); P(hipX - 11, FY - 3, 5, 2, '#3a3a40');
    }
    wheelSide(hipX + 1, FY - 10, 8);
  }
}

function limb(P, x0, y0, x1, y1, w, c) {
  const n = Math.max(1, y1 - y0);
  for (let y = y0; y <= y1; y++) { const x = Math.round(x0 + (x1 - x0) * (y - y0) / n); P(x - (w >> 1), y, w, 1, c); }
}

function hats(g, v, dir, hx0, hw, headTop, head, P, back) {
  const h = v.hat; if (!h) return;
  const c = h.col, d = sh(c, 0.75), side = dir === LEFT || dir === RIGHT;
  if (h.type === 'flatcap') {
    if (side) { P(hx0, headTop - 1, hw + 1, 4, c); P(hx0 - 3, headTop + 2, 4, 1, d); P(hx0 + 1, headTop - 1, hw - 1, 1, sh(c, 1.15)); }
    else { P(hx0 - 1, headTop - 1, hw + 2, 4, c); P(hx0 + 1, headTop - 1, hw - 2, 1, sh(c, 1.15)); if (!back) P(hx0, headTop + 3, hw, 1, d); }
  } else if (h.type === 'straw') {
    if (side) { P(hx0 + 1, headTop - 2, hw - 1, 4, c); P(hx0 - 3, headTop + 2, hw + 6, 1, d); P(hx0 + 1, headTop + 1, hw - 1, 1, h.col2); }
    else { P(hx0 + 1, headTop - 2, hw - 2, 4, c); P(hx0 - 3, headTop + 2, hw + 6, 1, d); P(hx0 + 1, headTop + 1, hw - 2, 1, h.col2); }
  } else if (h.type === 'peaked') {
    if (side) { P(hx0, headTop - 2, hw + 1, 5, c); P(hx0 - 3, headTop + 2, 4, 1, '#0c0c10'); P(hx0 + 1, headTop + 1, hw - 1, 1, h.col2); P(hx0 + 1, headTop - 1, 1, 1, h.col2); }
    else { P(hx0 - 1, headTop - 2, hw + 2, 5, c); P(hx0 - 1, headTop + 1, hw + 2, 1, sh(c, 0.7)); if (!back) { P(hx0 + 1, headTop + 3, hw - 2, 1, '#0c0c10'); P(hx0 + hw / 2 - 1, headTop - 1, 2, 2, h.col2); } }
  } else if (h.type === 'helmet') {
    if (side) { P(hx0, headTop - 1, hw + 2, 5, c); P(hx0 + 1, headTop - 1, hw - 1, 1, sh(c, 1.1)); P(hx0 - 1, headTop + 2, 3, 1, '#2a2a30'); P(hx0 + hw - 2, headTop + 4, 3, 3, d); }
    else { P(hx0 - 1, headTop - 1, hw + 2, 5, c); P(hx0, headTop - 1, hw, 1, sh(c, 1.1)); if (!back) P(hx0, headTop + 3, hw, 1, '#2a2a30'); }
  } else if (h.type === 'scarf') {
    if (side) { P(hx0 - 1, headTop - 1, hw + 1, 4, c); P(hx0 + hw - 4, headTop - 1, 5, head + 2, c); }
    else { P(hx0 - 1, headTop - 1, hw + 2, back ? head : 5, c); if (h.col2 && !back) P(hx0, headTop + 3, hw, 1, h.col2); P(hx0 - 1, headTop + 3, 2, 6, c); P(hx0 + hw - 1, headTop + 3, 2, 6, c); if (!back) { P(hx0 + 2, headTop + 3, 2, 1, v.hair); P(hx0 + hw - 4, headTop + 3, 2, 1, v.hair); } }
  }
}

let scratch = null, scratchG = null;
// Draw one 24x48 cell to a shared scratch canvas, then add shading and an outline.
function cell(v, dir, pose) {
  if (!scratch) { scratch = document.createElement('canvas'); scratch.width = CELL_W; scratch.height = CELL_H; scratchG = scratch.getContext('2d', { willReadFrequently: true }); }
  const cv = scratch, g = scratchG;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, CELL_W, CELL_H);
  if (dir === RIGHT) { g.translate(CELL_W, 0); g.scale(-1, 1); }
  const dd = dir === RIGHT ? LEFT : dir;
  if (v.chair !== 'empty') figure(g, v, dd, pose);
  if (v.chair) chairParts(g, v, dd, pose);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const img = g.getImageData(0, 0, CELL_W, CELL_H), d = img.data, W = CELL_W, H = CELL_H;
  const a = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? 0 : d[(y * W + x) * 4 + 3] > 127 ? 1 : 0;
  const out = new Uint8ClampedArray(d.length);
  const edge = [0x24, 0x1d, 0x26];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (a(x, y)) {
      let k = 1;
      if (!a(x - 1, y) || !a(x, y - 1)) k = 1.14; else if (!a(x + 1, y) || !a(x, y + 1)) k = 0.84;
      out[i] = Math.min(255, d[i] * k); out[i + 1] = Math.min(255, d[i + 1] * k); out[i + 2] = Math.min(255, d[i + 2] * k); out[i + 3] = 255;
    } else if (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1)) { out[i] = edge[0]; out[i + 1] = edge[1]; out[i + 2] = edge[2]; out[i + 3] = 255; }
  }
  g.putImageData(new ImageData(out, W, H), 0, 0);
  return cv;
}

export function buildAtlas() {
  const cv = document.createElement('canvas'); cv.width = COLS * CELL_W; cv.height = ROWS * CELL_H;
  const g = cv.getContext('2d');
  VARIANTS.forEach((v, r) => {
    for (let d = 0; d < DIRS; d++) for (let p = 0; p < POSES; p++) g.drawImage(cell(v, d, p), (d * POSES + p) * CELL_W, r * CELL_H);
  });
  return cv;
}
