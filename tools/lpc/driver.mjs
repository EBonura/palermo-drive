// Builds what the driver creator ("Il tuo autista", src/driver-compose.js) needs in the browser: assets/peds/lpc/driver/driver.json (the options, which LPC layers each one stacks, the colour
// ramps) and a copy of exactly those layer sheets, idle and sit only (the layers are the generator's art, see CREDITS.md and LICENSE.md of assets/peds/lpc). The layers are fetched by the
// game one by one, when the Garage's driver screen needs them. node tools/lpc/driver.mjs   (downloads missing layers from the pinned generator commit, as build.mjs does)
import fs from 'fs'; import path from 'path';
import { ROOT, getDef, layerFile, ramp, creditsOf } from './lib.mjs';
const OUT = process.argv[2] || path.join(ROOT, 'assets/peds/lpc/driver'), LAYERS = path.join(ROOT, 'tools/lpc/layers');
const BODIES = ['male', 'female'], BASE = { body: 'light', hair: 'orange', cloth: 'white', eye: 'blue' };
const hexOf = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
const sw = (m, n) => { const r = ramp(m, n); return hexOf(r[Math.min(3, r.length - 1)]); };
// ---- the options: [id, [it, en], layer ids] (colours are palette ramp names)
const P = (...a) => a.map(([id, it, en, layers]) => ({ id, name: [it, en], layers }));
const HAIR = P(['none', 'Calvo', 'Bald', []], ['short', 'Corti', 'Short', ['hair/short/hair_parted3']], ['cowlick', 'Ciuffo', 'Tuft', ['hair/short/hair_cowlick']], ['idol', 'Frangetta', 'Fringe', ['hair/short/hair_idol']],
  ['buzz', 'Rasati', 'Buzzcut', ['hair/bald/hair_buzzcut']], ['quiff', 'Ciuffo alto', 'Flat top', ['hair/afro/hair_flat_top_straight']], ['sidepart', 'Riga di lato', 'Side part', ['hair/bob/hair_bob_side_part']],
  ['balding', 'Stempiato', 'Balding', ['hair/bald/hair_balding']], ['bun', 'Chignon', 'Bun', ['hair/braids/hair_bangs_bun']], ['pony', 'Coda', 'Ponytail', ['hair/braids/hair_high_ponytail']],
  ['bob', 'Caschetto', 'Bob', ['hair/bob/hair_bob']], ['lob', 'Bob lungo', 'Long bob', ['hair/bob/hair_lob']], ['long', 'Lunghi', 'Long', ['hair/long/hair_long_straight']],
  ['centre', 'Lunghi con riga', 'Centre part', ['hair/long/hair_long_center_part']], ['wavy', 'Mossi', 'Wavy', ['hair/long/hair_wavy']], ['curlyl', 'Ricci lunghi', 'Long curls', ['hair/curly/hair_curly_long']],
  ['curlys', 'Ricci corti', 'Short curls', ['hair/curly/hair_curly_short']]);
const BEARD = P(['none', 'Nessuna', 'None', []], ['stubble', 'Barbetta', 'Stubble', []], ['moustache', 'Baffi', 'Moustache', ['hair/mustaches/beards_chevron']], ['goatee', 'Pizzetto', 'Goatee', ['hair/beards/beards_trimmed']], ['full', 'Barba', 'Beard', ['hair/beards/beards_medium']]);
const TOP = P(['tshirt', 'Maglietta', 'T-shirt', ['torso/shirts/shortsleeve/torso_clothes_tshirt']], ['polo', 'Polo', 'Polo', ['torso/shirts/shortsleeve/torso_clothes_shortsleeve_polo']],
  ['long', 'Maniche lunghe', 'Long sleeves', ['torso/shirts/longsleeve/torso_clothes_longsleeve2']], ['longpolo', 'Polo lunga', 'Long polo', ['torso/shirts/longsleeve/torso_clothes_longsleeve2_polo']],
  ['sleeveless', 'Canotta', 'Vest top', ['torso/shirts/sleeveless/torso_clothes_sleeveless2']], ['vneck', 'Canotta a V', 'V-neck vest', ['torso/shirts/sleeveless/torso_clothes_sleeveless2_vneck']]);
const BOTTOM = P(['pants', 'Pantaloni', 'Trousers', ['legs/pants/legs_pants']], ['shorts', 'Pantaloncini', 'Shorts', ['legs/shorts/legs_shorts']], ['skirt', 'Gonna', 'Skirt', ['legs/skirts/legs_skirts_plain']]);
const SHOES = P(['shoes', 'Scarpe', 'Shoes', ['feet/shoes/feet_shoes_basic']], ['boots', 'Stivali', 'Boots', ['feet/boots/feet_boots_basic']]);
const HEADS = { young: { male: 'head/heads/human/heads_human_male', female: 'head/heads/human/heads_human_female' }, old: { male: 'head/heads/human/heads_human_male_elderly', female: 'head/heads/human/heads_human_female_elderly' } };
const names = { skin: ['light', 'amber', 'olive', 'taupe', 'bronze', 'brown', 'black'], eye: ['blue', 'green', 'brown', 'gray'],
  hair: ['black', 'dark_brown', 'chestnut', 'light_brown', 'ginger', 'red', 'blonde', 'platinum', 'gray', 'white', 'rose', 'purple', 'blue', 'green'],
  cloth: ['white', 'black', 'charcoal', 'gray', 'navy', 'blue', 'sky', 'teal', 'green', 'forest', 'yellow', 'orange', 'red', 'maroon', 'pink', 'rosanero', 'brown', 'tan'] };
const NAMES = { // colour names, it / en
  light: ['Chiara', 'Fair'], amber: ['Ambra', 'Amber'], olive: ['Olivastra', 'Olive'], taupe: ['Nocciola', 'Taupe'], bronze: ['Bronzo', 'Bronze'], brown: ['Scura', 'Brown'], black: ['Nera', 'Dark'],
  blue: ['Blu', 'Blue'], green: ['Verdi', 'Green'], gray: ['Grigio', 'Grey'], dark_brown: ['Castano scuro', 'Dark brown'], chestnut: ['Castano', 'Chestnut'], light_brown: ['Castano chiaro', 'Light brown'],
  ginger: ['Rame', 'Copper'], red: ['Rosso', 'Red'], blonde: ['Biondo', 'Blonde'], platinum: ['Platino', 'Platinum'], white: ['Bianco', 'White'], rose: ['Rosa', 'Pink'], purple: ['Viola', 'Purple'],
  charcoal: ['Antracite', 'Charcoal'], navy: ['Blu notte', 'Navy'], sky: ['Azzurro', 'Sky'], teal: ['Petrolio', 'Teal'], forest: ['Verde scuro', 'Forest'], yellow: ['Giallo', 'Yellow'], orange: ['Arancio', 'Orange'],
  maroon: ['Bordeaux', 'Maroon'], pink: ['Rosa', 'Pink'], rosanero: ['Rosanero', 'Rosanero'], tan: ['Sabbia', 'Sand'] };
const colourList = (m, list) => list.map(id => ({ id, sw: sw(m, id), name: NAMES[id] || [id, id] }));
// ---- resolve layers
const layerIds = new Set(); const addIds = o => o.forEach(x => (x.layers || []).forEach(id => layerIds.add(id)));
[HAIR, BEARD, TOP, BOTTOM, SHOES].forEach(addIds); layerIds.add('body/body'); for (const a of Object.values(HEADS)) Object.values(a).forEach(id => layerIds.add(id));
const matsOf = def => { const r = def.recolors; if (!r) return []; if (r.material) return [r.material]; return [...new Set(Object.values(r).filter(v => v && v.material).map(v => v.material))]; };
const layers = {}, bodiesOf = {}, files = new Set(), used = [], copy = async (rel, anim) => {
  let f = await layerFile(rel, anim); let name = anim;
  if (!f && anim === 'idle') f = await layerFile(rel, 'walk');
  if (!f) return false;
  const dst = path.join(OUT, rel, anim + '.png'); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(f, dst); files.add(rel + anim); return true;
};
for (const id of [...layerIds].sort()) {
  const def = getDef(id), parts = [];
  for (let n = 1; n < 6; n++) {
    const ly = def['layer_' + n]; if (!ly) break; if (ly.custom_animation) continue;
    const rel = {}; for (const bt of BODIES) if (ly[bt]) rel[bt] = ly[bt];
    if (!Object.keys(rel).length) continue;
    parts.push({ z: ly.zPos ?? 100, rel, mats: matsOf(def) });
    for (const r of new Set(Object.values(rel))) for (const a of ['idle', 'sit']) await copy(r, a);
  }
  if (def.variants && def.variants.length) throw new Error('layer with colour files, not for the creator: ' + id);
  layers[id] = parts; bodiesOf[id] = BODIES.filter(bt => parts.some(p => p.rel[bt]));
  used.push(...parts.flatMap(p => Object.values(p.rel).map(rel => ({ id, rel, def }))));
}
// options that are not available for a body type (no layer file for it) are hidden for that body
const avail = o => ({ ...o, bodies: o.layers.length ? BODIES.filter(bt => o.layers.every(id => bodiesOf[id].includes(bt))) : BODIES });
const palettes = {}; for (const m of ['body', 'hair', 'cloth', 'eye']) { palettes[m] = {}; }
const allNames = m => { const fs2 = require_names(m); return fs2; };
function require_names(m) { return JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'defs/palette_definitions', m, `${m}_ulpc.json`), 'utf8')); }
for (const m of ['body', 'hair', 'cloth', 'eye']) for (const n of Object.keys(require_names(m))) { try { palettes[m][n] = ramp(m, n).map(hexOf); } catch (e) { /* not a ramp of this material */ } }
palettes.cloth.rosanero = ramp('cloth', 'rosanero').map(hexOf);   // Palermo FC's pink and black, a ramp of our own (tools/lpc/lib.mjs)
for (const m of Object.keys(palettes)) if (BASE[m] && !palettes[m][BASE[m]]) throw new Error('no base ramp ' + m);
// the colour mapping the generator uses: the base ramp's colours are replaced step by step by the chosen ramp
const manifest = {
  v: 1, bodies: BODIES, base: BASE, heads: HEADS, layers, files: [...files].sort(), pal: palettes,
  options: { skin: colourList('body', names.skin), eye: colourList('eye', names.eye), hairCol: colourList('hair', names.hair), cloth: colourList('cloth', names.cloth),
    hair: HAIR.map(avail), beard: BEARD.map(avail), top: TOP.map(avail), bottom: BOTTOM.map(avail), shoes: SHOES.map(avail),
    glasses: P(['none', 'Nessuno', 'None', []], ['round', 'Tondi', 'Round', []], ['tortoise', 'Tartaruga', 'Tortoise', []], ['rect', 'Squadrati', 'Square', []]),
    hat: P(['none', 'Nessuno', 'None', []], ['coppola', 'Coppola', 'Flat cap', []], ['straw', 'Paglietta', 'Straw hat', []], ['cap', 'Berretto', 'Cap', []], ['vigile', 'Cappello da vigile', 'Traffic warden cap', []], ['fazzoletto', 'Fazzoletto', 'Headscarf', []]) },
};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'driver.json'), JSON.stringify(manifest));
// credits: every layer shipped
const cf = path.join(ROOT, 'assets/peds/lpc/CREDITS.json'), have = JSON.parse(fs.readFileSync(cf, 'utf8')), add = creditsOf(used).filter(c => !have.some(h => h.file === c.file));
if (add.length) { fs.writeFileSync(cf, JSON.stringify([...have, ...add], null, 1)); console.log('credits added:', add.map(a => a.file).join(', ')); }
let bytes = 0; for (const f of files) for (const a of ['idle', 'sit']) { const p = path.join(OUT, f.endsWith('idle') ? f : f, ''); }
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const all = walk(OUT).filter(f => f.endsWith('.png')); for (const f of all) bytes += fs.statSync(f).size;
console.log('driver assets:', all.length, 'sheets,', (bytes / 1024).toFixed(0), 'KB, manifest', (fs.statSync(path.join(OUT, 'driver.json')).size / 1024).toFixed(0), 'KB;', layerIds.size, 'layers');
