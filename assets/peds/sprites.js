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
];
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
    const lb = sw === 1 ? FY : sw === -1 ? FY - 2 : FY, rb = sw === -1 ? FY : sw === 1 ? FY - 2 : FY;
    const legs = [[12 - 5, lb], [12, rb]];
    for (const [lx, bot] of legs) {
      P(lx, hipY, 5, bot - hipY, legCol);
      if (isShorts) P(lx, hipY, 5, B.len, B.col);
      if (B.stripe) P(lx + (lx < 12 ? 0 : 4), hipY + 2, 1, bot - hipY - 4, B.stripe);
      P(lx - (lx < 12 ? 1 : 0), bot - 2, 6, 2, v.shoes);
    }
    P(11, hipY + 4, 1, FY - hipY - 6, sh(legCol, 0.6));
    if (isSkirt || isRobe) { // garment over the legs, hem swaying a little
      const sway = sw;
      for (let y = hipY; y < hemY; y++) { const t = (y - hipY) / Math.max(1, hemY - hipY), ex = Math.round(t * (isRobe ? 2 : 1.5)); P(x0 - ex + (sway && y > hemY - 3 ? sway : 0), y, tw + ex * 2, 1, B.col); }
      if (isRobe) { P(12, hipY + 1, 1, hemY - hipY - 1, sh(B.col, 1.9)); }
    }
    // torso
    P(x0, shY, tw, tor, top); P(x0, shY, 1, 1, '#0000'); g.clearRect(x0, shY, 1, 1); g.clearRect(x1, shY, 1, 1);
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
      if (v.sleeve === 'short') { P(ax, shY + 1, 3, 5, top); P(ax, shY + 6, 3, len - 5, skin); }
      else { P(ax, shY + 1, 3, len - 2, top); P(ax, shY + len - 1, 3, 2, skin); if (v.hood) P(ax, shY + len - 3, 3, 1, topD); }
      P(ax + (side < 0 ? 2 : 0), shY + 1, 1, len - 1, sh(top, 0.82));
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
    // head
    const hx0 = 12 - (hw >> 1);
    P(hx0, headTop, hw, head, skin); g.clearRect(hx0, headTop, 1, 1); g.clearRect(hx0 + hw - 1, headTop, 1, 1);
    P(hx0 + 1, headTop + head - 2, hw - 2, 2, sh(skin, 0.94)); P(10, shY - 1, 4, 1, skinD);
    const hs = v.hairStyle || 'short';
    if (back) { // hair covers the back of the head
      P(hx0, headTop, hw, hs === 'bald' ? 4 : head - 2, hair); if (hs === 'long') P(hx0, headTop, hw, head + 4, hair);
      if (hs === 'bun') P(10, headTop - 2, 4, 3, hair);
      if (hs === 'bald') { P(hx0, headTop + 3, 2, 4, hair); P(hx0 + hw - 2, headTop + 3, 2, 4, hair); }
    } else {
      const fr = hs === 'fringe' ? 4 : hs === 'bald' ? 0 : 3;
      if (hs !== 'bald') P(hx0, headTop, hw, fr, hair); else { P(hx0, headTop + 2, 2, 4, hair); P(hx0 + hw - 2, headTop + 2, 2, 4, hair); P(hx0 + 2, headTop, hw - 4, 1, sh(skin, 1.12)); }
      if (hs !== 'bald') { P(hx0, headTop, 1, 6, hair); P(hx0 + hw - 1, headTop, 1, 6, hair); }
      if (hs === 'long') { P(hx0 - 1, headTop + 2, 2, head + 3, hair); P(hx0 + hw - 1, headTop + 2, 2, head + 3, hair); }
      if (hs === 'bun') P(10, headTop - 2, 4, 3, hair);
      const ey = headTop + Math.round(head * 0.55);
      if (v.glasses) { P(hx0 + 1, ey, hw - 2, 2, v.glasses); } else { P(hx0 + 2, ey, 2, 2, '#1a1414'); P(hx0 + hw - 4, ey, 2, 2, '#1a1414'); }
      P(11, ey + 2, 2, 1, skinD); // nose shadow
      P(10, ey + 4, 4, 1, v.beard ? v.beard : sh(skin, 0.7));
      if (v.beard) { P(hx0, ey + 3, hw, head - (ey - headTop) - 3, v.beard); P(10, ey + 4, 4, 1, sh(skin, 0.8)); }
    }
    hats(g, v, dir, hx0, hw, headTop, head, P, back);
  } else {
    // side view, facing left; the right view is mirrored afterwards
    const hipX = 11, torW = Math.max(6, Math.round(tw * 0.62));
    const tx0 = hipX - (torW >> 1) - 1, tx1 = tx0 + torW - 1;
    const swing = v.bounce ? 3 : 4;
    const near = (sw === 0 ? 0 : sw), fx = hipX - swing * near;     // near foot x (forward = -x)
    const limbs = (fxn, lift, c, shoe, dark) => {
      const cc = dark ? sh(c, 0.75) : c;
      limb(P, hipX, hipY, fxn, FY - lift, 4, cc);
      if (isShorts) limb(P, hipX, hipY, hipX + (fxn - hipX) * B.len / leg, hipY + B.len, 4, dark ? sh(B.col, 0.75) : B.col);
      P(fxn - 2, FY - lift - 2, 5, 2, dark ? sh(shoe, 0.75) : shoe);
    };
    // far leg first
    limbs(2 * hipX - fx, sw === 0 ? 0 : 1, legCol, v.shoes, true);
    // far arm (behind torso)
    const armHandN = hipX + 3 * near; // near arm goes back when the near leg is forward
    const sideArm = (hxn, dark) => {
      const c = dark ? sh(top, 0.7) : top;
      limb(P, hipX, shY + 2, hxn, shY + armH - 1, 3, v.sleeve === 'short' ? c : c);
      if (v.sleeve === 'short') limb(P, hxn - (hxn - hipX) * 0.35, shY + 6, hxn, shY + armH - 1, 3, dark ? sh(skin, 0.75) : skin);
      P(hxn - 1, shY + armH - 1, 3, 2, dark ? sh(skin, 0.75) : skin);
    };
    sideArm(2 * hipX - armHandN, true);
    if (v.backpack) { P(tx1 + 1, shY + 1, 4, tor - 3, v.backpack); P(tx1 + 2, shY + 3, 2, 3, sh(v.backpack, 0.75)); }
    if (v.hood) P(tx1, shY - 1, 3, 4, sh(top, 0.7));
    if (isSkirt || isRobe) {
      for (let y = hipY; y < hemY; y++) { const t = (y - hipY) / Math.max(1, hemY - hipY), ex = Math.round(t * (isRobe ? 3 : 2)); P(tx0 - ex + (y > hemY - 3 ? -sw : 0), y, torW + ex * 2, 1, B.col); }
    }
    // near leg over the garment hem
    limbs(fx, sw === 0 ? 0 : 0, legCol, v.shoes, false);
    if (isSkirt || isRobe) { for (let y = hipY; y < Math.min(hemY, hipY + 5); y++) P(tx0 - 1, y, torW + 2, 1, B.col); }
    // torso
    P(tx0, shY, torW, tor, top); g.clearRect(tx0, shY, 1, 1);
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
      if (hs === 'long') P(hx0 + hwid - 5, headTop, 5, head + 5, hair);
      if (hs === 'bun') P(hx0 + hwid - 2, headTop - 1, 4, 4, hair);
    }
    P(hx0 + 1, ey, 1, 2, v.glasses || '#1a1414'); if (v.glasses) P(hx0 + 1, ey, 3, 2, v.glasses);
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
  } else if (h.type === 'scarf') {
    if (side) { P(hx0 - 1, headTop - 1, hw + 1, 4, c); P(hx0 + hw - 4, headTop - 1, 5, head + 2, c); }
    else { P(hx0 - 1, headTop - 1, hw + 2, back ? head : 5, c); P(hx0 - 1, headTop + 3, 2, 6, c); P(hx0 + hw - 1, headTop + 3, 2, 6, c); if (!back) { P(hx0 + 2, headTop + 3, 2, 1, v.hair); P(hx0 + hw - 4, headTop + 3, 2, 1, v.hair); } }
  }
}

// Draw one 24x48 cell to its own canvas, then add shading and an outline.
function cell(v, dir, pose) {
  const cv = document.createElement('canvas'); cv.width = CELL_W; cv.height = CELL_H;
  const g = cv.getContext('2d', { willReadFrequently: true });
  if (dir === RIGHT) { g.translate(CELL_W, 0); g.scale(-1, 1); }
  figure(g, v, dir === RIGHT ? LEFT : dir, pose);
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
