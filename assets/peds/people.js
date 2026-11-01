// The character model's parameters, their defaults, and the random generator that fills in a person from a type (nonna, vendor, tourist, metal...).
// The same fields drive the Garage driver creator, so every field here is a plain value (numbers, hex strings, small option names).
import { ci, mixc } from './raster.js';

// ---------- the option lists (the creator shows these; the generator draws from them) ----------
export const SKINS = ['#f1cdb0', '#ecc2a4', '#e3b99a', '#dcac8c', '#d6a284', '#cf9d7c', '#c99872', '#c2916c', '#bf8a66', '#b8744c', '#9a6a48', '#7a4e34', '#5e3a28'];
export const HAIR_COLS = ['#17120f', '#2a1c14', '#4a2a1a', '#6b4426', '#8a6a3a', '#c8a03a', '#d8b058', '#a8452a', '#b8763e', '#9a9690', '#dcd8d0', '#e8559a', '#3a7ad0'];
export const HAIR_STYLES = ['bald', 'buzz', 'short', 'fade', 'quiff', 'fringe', 'comb', 'bun', 'ponytail', 'bob', 'long', 'wavy', 'curly', 'monk'];
export const BEARDS = ['', 'stubble', 'moustache', 'goatee', 'chinstrap', 'full'];
export const GLASSES = ['', 'rect', 'round', 'big'];
export const EYE_COLS = ['#2a1a10', '#4a3424', '#5a6a4a', '#4a6a8a', '#6a7a82'];
export const TOP_TYPES = ['tee', 'polo', 'shirt', 'jacket', 'hoodie'];
export const FACE_RANGES = {   // [min, max, default] of the continuous face fields, for the creator's sliders
  fw: [3.9, 4.8, 4.35], jaw: [0, 1, 0.5], cheek: [0, 1, 0.5], chinW: [0, 0.9, 0.4], eyeGap: [1.55, 2.4, 1.95], eyeSize: [0.8, 1.3, 1], eyeTilt: [-0.25, 0.3, 0.05], eyeY: [-0.5, 0.6, 0],
  browThick: [0.3, 0.95, 0.55], browTilt: [-0.25, 0.3, 0.05], browArch: [0, 0.35, 0.12], browY: [-0.3, 0.4, 0], noseLen: [0.8, 1.9, 1.3], noseW: [0.7, 1.3, 1], noseY: [-0.4, 0.4, 0],
  mouthW: [2.2, 3.7, 3], mouthY: [-0.4, 0.4, 0], lip: [0.1, 0.9, 0.4], smile: [-0.6, 1, 0.15], earSize: [0.8, 1.3, 1], earOut: [0, 1, 0.4] };

const D = (v, d) => v === undefined ? d : v;

// ---------- completing a spec (every field the model reads gets a value) ----------
export function finalize(sp) {
  const f = sp.face = { eyeShape: 'almond', eyeCol: '#3a2a1c', age: 0.2, stubbleD: 0.5, ...Object.fromEntries(Object.entries(FACE_RANGES).map(([k, r]) => [k, r[2]])), ...(sp.face || {}) };
  f.browCol = f.browCol || mixc(sp.hair || '#2a1c14', '#1a1210', 0.35); f.lipCol = f.lipCol || mixc(sp.skin, '#b0505a', 0.4);
  if (sp.beard && !f.beard) f.beard = sp.beard;           // a variant may say beard: '#colour' (a full beard in that colour) like the old cast
  if (typeof sp.beard === 'string' && sp.beard[0] === '#') { f.beard = 'full'; f.beardCol = sp.beard; }
  if (sp.stubble && typeof sp.stubble === 'string') f.stubble = sp.stubble;
  if (sp.glasses && typeof sp.glasses === 'string') sp.glasses = { frame: sp.glasses, style: sp.glassStyle || 'rect', tortoise: !!sp.tortoise };
  if (sp.bigGlasses && !sp.glasses) sp.glasses = { frame: sp.bigGlasses, style: 'big' };
  sp.hhU = D(sp.head, 10) * 1.1;
  sp.hairStyle = sp.hairStyle || 'short';
  sp.bottom = sp.bottom || { type: 'trousers', col: '#2a2e38' };
  sp.sleeve = sp.sleeve || 'short';
  return sp;
}

// ---------- the generator ----------
export const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
export const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
const wpick = (r, pairs) => { let t = 0; for (const p of pairs) t += p[1]; let x = r() * t; for (const p of pairs) if ((x -= p[1]) <= 0) return p[0]; return pairs[0][0]; };
const rng2 = (r, a, b) => a + (b - a) * r();
const DARK = ['#17120f', '#1c1614', '#2a1c14', '#2a1a14', '#3a2418'], BROWN = ['#4a2a1a', '#5a3a28', '#6b4426', '#8a5a32'], LIGHT = ['#8a6a3a', '#c8a03a', '#d4a050', '#d8b058'], GINGER = ['#a8452a', '#b8763e', '#b5532c'], GREY = ['#9a9690', '#8c8c8c', '#b8b4ac', '#c8c4bc', '#dcd8d0', '#bdb8b0'];
const STYLES = {   // hair styles by [sex][age]
  m: { kid: [['short', 3], ['fringe', 2], ['curly', 1], ['buzz', 1]], teen: [['short', 2], ['fade', 3], ['quiff', 2], ['fringe', 2], ['curly', 1], ['buzz', 1]], young: [['short', 2], ['fade', 3], ['quiff', 3], ['fringe', 1], ['curly', 1.2], ['buzz', 1], ['comb', 1]], adult: [['short', 4], ['fade', 2], ['comb', 2], ['bald', 1.2], ['buzz', 1], ['quiff', 1]], old: [['bald', 3], ['monk', 2], ['comb', 3], ['short', 2]] },
  f: { kid: [['bob', 2], ['ponytail', 2], ['long', 2], ['bun', 1]], teen: [['long', 3], ['ponytail', 3], ['bun', 1.5], ['wavy', 2], ['bob', 1]], young: [['long', 3], ['wavy', 2.5], ['ponytail', 2], ['bun', 2], ['bob', 1.5], ['curly', 1]], adult: [['bob', 3], ['long', 3], ['bun', 2], ['wavy', 2], ['short', 1], ['curly', 1]], old: [['bun', 3], ['bob', 2], ['short', 3], ['wavy', 1]] } };

// A person of a given type. t carries what the type fixes (the outfit, sometimes the hair); k is the entry number of this type: entry 0 keeps what the type says, the others vary it.
export function makePerson(t, k, seed) {
  const r = rngOf(seed), sex = t.sex || 'm', age = t.age || 'adult', sp = { ...t };
  const keep = k === 0 && !t.gen;
  // skin: Mediterranean spread, with a few darker and a few paler
  if (!keep || !sp.skin) sp.skin = wpick(r, [[SKINS[0], 1], [SKINS[1], 2], [SKINS[2], 4], [SKINS[3], 5], [SKINS[4], 5], [SKINS[5], 5], [SKINS[6], 4], [SKINS[7], 3], [SKINS[8], 3], [SKINS[9], 1.5], [SKINS[10], 1.2], [SKINS[11], 0.8], [SKINS[12], 0.5]]);
  // hair
  if (!keep || !sp.hair) {
    const gr = age === 'old' ? 0.9 : age === 'adult' ? 0.14 : 0;
    sp.hair = r() < gr ? pick(r, GREY) : wpick(r, [[pick(r, DARK), 6], [pick(r, BROWN), 3], [pick(r, LIGHT), age === 'kid' || age === 'teen' ? 1.4 : 0.8], [pick(r, GINGER), 0.7]]);
    if (r() < (age === 'young' || age === 'teen' ? 0.035 : 0.01)) sp.hair = pick(r, ['#e8559a', '#3a7ad0', '#7a3ab8', '#2fa34a']);
  }
  if (!keep || !t.hairStyle) sp.hairStyle = t.styles ? wpick(r, t.styles) : wpick(r, STYLES[sex][age]);
  if (sp.hat && !keep) { /* a hat or a scarf: the hair under it still varies */ }
  // face
  const fr = (key, bias = 0, spread = 0.5) => { const [a, b, d] = FACE_RANGES[key]; const u = Math.min(1, Math.max(0, 0.5 + bias + (r() + r() + r() - 1.5) * spread)); return a + (b - a) * u; };
  const kid = age === 'kid', f = {
    fw: kid ? 4.2 : sex === 'f' ? fr('fw', -0.12) : fr('fw', 0.05), jaw: fr('jaw', sex === 'f' ? -0.15 : 0.05), cheek: fr('cheek', kid ? 0.25 : 0), chinW: fr('chinW', sex === 'f' ? -0.1 : 0.05),
    eyeGap: fr('eyeGap'), eyeSize: fr('eyeSize', kid ? 0.28 : sex === 'f' ? 0.1 : 0), eyeTilt: fr('eyeTilt'), eyeY: kid ? -0.35 + r() * 0.2 : fr('eyeY'), eyeShape: wpick(r, [['almond', 4], ['round', 3], ['narrow', 2], ['wide', 1.5]]),
    eyeCol: wpick(r, [['#2a1a10', 6], ['#4a3424', 5], ['#5a6a4a', 1.5], ['#4a6a8a', 1.5], ['#6a7a82', 1]]),
    browThick: fr('browThick', sex === 'f' ? -0.15 : 0.1), browTilt: fr('browTilt'), browArch: fr('browArch', sex === 'f' ? 0.15 : 0), browY: fr('browY'), noseLen: fr('noseLen', kid ? -0.3 : 0), noseW: fr('noseW'), noseY: fr('noseY'),
    mouthW: fr('mouthW', sex === 'f' ? -0.05 : 0.05), mouthY: fr('mouthY'), lip: fr('lip', sex === 'f' ? 0.25 : -0.1), smile: fr('smile', 0.04, 0.7), earSize: fr('earSize', kid ? 0.2 : 0), earOut: fr('earOut'),
    age: { kid: 0, teen: 0.05, young: 0.12, adult: 0.38, old: 0.85 }[age] + r() * 0.12, blush: kid || (sex === 'f' && age === 'old' && r() < 0.4), freckles: (age === 'kid' || age === 'teen') && r() < 0.25,
    ...(t.face || {}) };
  // facial hair
  if (sex === 'm' && !kid && f.beard === undefined && !sp.beard) {
    const pb = t.beardP !== undefined ? t.beardP : age === 'old' ? 0.28 : age === 'adult' ? 0.38 : age === 'young' ? 0.22 : 0.04;
    if (r() < pb) f.beard = t.beardP !== undefined ? wpick(r, [['full', 6], ['goatee', 1.5], ['moustache', 1], ['stubble', 1]]) : wpick(r, [['stubble', 5], ['full', 2.4], ['moustache', 1.1], ['goatee', 1.1], ['chinstrap', 0.7]]);
    if (f.beard === 'stubble') { f.stubble = '#3a2c24'; f.stubbleD = 0.35 + r() * 0.3; f.beard = undefined; }
    else if (f.beard) f.beardCol = age === 'old' && r() < 0.7 ? pick(r, GREY) : sp.hair;
  }
  sp.face = f;
  // glasses
  if (sp.glasses === undefined && sp.bigGlasses === undefined && !kid) {
    const pg = age === 'old' ? 0.4 : age === 'adult' ? 0.22 : 0.1;
    if (r() < pg) sp.glasses = { frame: wpick(r, [['#18161a', 6], ['#5a3a1e', 2], ['#8a6a3a', 1], ['#c8c4bc', 0.8]]), style: wpick(r, [['rect', 4], ['round', 2.5], ['big', 1.3]]), tortoise: r() < 0.2 };
  }
  if (!keep) {
    sp.tw = (sp.tw || 12) + (r() < 0.5 ? 0 : sp.tw ? Math.round(rng2(r, -1, 1)) : Math.round(rng2(r, -1, 1.5)));
    if (!sp.leg) sp.leg = kid ? 11 : 19 + Math.round(rng2(r, -1, 1.5));
    if (t.varyTop) { sp.top = wpick(r, TOPS); }
    if (t.varyBottom) sp.bottom = { ...sp.bottom, col: pick(r, ['#2a2e38', '#35527d', '#4b6a96', '#26324a', '#3a3a44', '#c9b99a', '#4a4640']) };
    if (t.varyShoes) sp.shoes = pick(r, ['#eeeeee', '#2c2622', '#6b4a30', '#17151a', '#c43c36', '#3a4a63']);
  }
  sp.fem = sex === 'f'; sp.sex = sex; sp.ageGroup = age;
  if (sp.fem && !sp.tw) sp.tw = 11;
  return finalize(sp);
}
const TOPS = [['#f0eee8', 3], ['#3f9ab8', 2], ['#d9443c', 2], ['#2f6b49', 2], ['#e0b42f', 2], ['#4a4f5a', 2], ['#e87aa0', 1.5], ['#4fa9a0', 2], ['#3f6bb0', 3], ['#c8b78e', 1.5], ['#17151a', 2], ['#c43c36', 1.5], ['#7a8a62', 1], ['#6a7a98', 1.5]];
