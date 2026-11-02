// Turns one cast entry of assets/peds/sprites.js (a generated person: sex, age, skin, hair, face, outfit, props) into a stack of LPC layers plus our own painted extras.
// Layers listed here are only ones that offer a permissive licence (CC0, CC-BY, OGA-BY); tools/lpc/credits.mjs reports what ended up used.
import { nearestRamp, naturalHair, dyedHair, pickVariant, getDef } from './lib.mjs';
const hashN = (s, n) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) % n; };
const HAIR = {
  short: ['hair/short/hair_parted3', 'hair/short/hair_cowlick', 'hair/short/hair_idol'], fade: ['hair/bald/hair_buzzcut'], buzz: ['hair/bald/hair_buzzcut'], quiff: ['hair/afro/hair_flat_top_straight', 'hair/short/hair_cowlick'], fringe: ['hair/bob/hair_bob_side_part', 'hair/short/hair_idol'], comb: ['hair/short/hair_parted3'],
  bun: ['hair/braids/hair_bangs_bun'], ponytail: ['hair/braids/hair_high_ponytail'], bob: ['hair/bob/hair_bob', 'hair/bob/hair_lob'], long: ['hair/long/hair_long_straight', 'hair/long/hair_long_center_part'], wavy: ['hair/long/hair_wavy'], curly: ['hair/curly/hair_curly_long', 'hair/curly/hair_curly_short'],
  monk: ['hair/bald/hair_balding'], swept: ['hair/short/hair_cowlick'], curlylong: ['hair/curly/hair_curly_long'], bald: [],
};
const HAIR_FEM_SHORT = ['hair/bob/hair_bob', 'hair/bob/hair_lob'];
const HAIR_KID = { m: ['hair/short/hair_swoop_side', 'hair/short/hair_parted_side_bangs'], f: ['hair/bob/hair_relm_short', 'hair/short/hair_parted_side_bangs'] };
const BEARD = { full: 'hair/beards/beards_medium', goatee: 'hair/beards/beards_trimmed', chinstrap: 'hair/beards/beards_trimmed', moustache: 'hair/mustaches/beards_chevron' };
const eyeOf = hex => nearestRamp('eye', hex || '#4a3424');
const cloth = hex => { const h = hex.toLowerCase(); const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16); return (r > 215 && g > 130 && g < 190 && b > 160 && b < 215) ? 'rosanero' : nearestRamp('cloth', hex); };
const DYED = /^#(e8559a|3a7ad0|7a3ab8|2fa34a|e87aa0)/i;

export function stackOf(sp, idx) {
  if (sp.chair === 'empty') return { id: sp.id, body: 'male', layers: [], extras: [['wheelchair', 'black', true]], emptyChair: true, noSit: true };
  const kid = sp.ageGroup === 'kid', teen = sp.ageGroup === 'teen', old = sp.ageGroup === 'old', fem = sp.sex === 'f', key = sp.id + idx;
  const body = kid ? 'child' : teen ? 'teen' : fem ? 'female' : 'male';
  const skin = nearestRamp('body', sp.skin), eye = eyeOf(sp.face && sp.face.eyeCol);
  const headId = kid ? 'head/heads/human/heads_human_child' : fem ? (old ? 'head/heads/human/heads_human_female_elderly' : 'head/heads/human/heads_human_female') : (old ? 'head/heads/human/heads_human_male_elderly' : 'head/heads/human/heads_human_male');
  const L = [{ id: 'body/body', mat: { body: skin } }, { id: headId, mat: { body: skin, eye } }];
  const X = [];   // extras: [name, ...args]
  const B = sp.bottom || {}, topC = cloth(sp.top || '#2a2e38');
  // ----- legs
  const legCol = B.type === 'robe' ? cloth(B.col) : cloth(B.col || '#2a2e38');
  if (kid) { const def = getDef(B.type === 'skirt' ? 'legs/skirts/legs_childskirts' : 'legs/pants/legs_childpants'); L.push({ id: def === getDef('legs/skirts/legs_childskirts') ? 'legs/skirts/legs_childskirts' : 'legs/pants/legs_childpants', variant: pickVariant(def, legCol) }); }
  else if (B.type === 'shorts') L.push({ id: 'legs/shorts/legs_shorts', mat: { cloth: legCol } });
  else if (B.type === 'skirt' || B.type === 'robe') L.push({ id: 'legs/skirts/legs_skirts_plain', mat: { cloth: B.type === 'skirt' && !B.long ? cloth(B.col) : legCol } });
  else L.push({ id: 'legs/pants/legs_pants', mat: { cloth: B.jeans ? 'blue' : legCol } });
  // ----- shoes
  const shoeC = cloth(sp.shoes || '#2c2622');
  if (!kid || true) L.push(sp.boots ? { id: 'feet/boots/feet_boots_basic', mat: { cloth: 'black' } } : { id: 'feet/shoes/feet_shoes_basic', mat: { cloth: shoeC } });
  // ----- torso
  const longS = sp.sleeve === 'long', none = sp.sleeve === 'none';
  if (kid) { const def = getDef('torso/shirts/torso_clothes_child_shirt'); L.push({ id: 'torso/shirts/torso_clothes_child_shirt', variant: pickVariant(def, topC) }); }
  else if (sp.waistcoat && !kid) { L.push({ id: 'torso/shirts/longsleeve/torso_clothes_longsleeve2', mat: { cloth: topC } }); L.push({ id: 'torso/shirts/sleeveless/torso_clothes_sleeveless2_vneck', mat: { cloth: nearestRamp('cloth', sp.waistcoat) } }); }   // a waistcoat over a long-sleeved shirt (the coachman)
  else if (sp.vest && sp.vestOver) { L.push({ id: 'torso/shirts/shortsleeve/torso_clothes_tshirt', mat: { cloth: topC } }); L.push({ id: 'torso/shirts/sleeveless/torso_clothes_sleeveless2_vneck', mat: { cloth: nearestRamp('cloth', sp.vest) } }); X.push(['patches']); }
  else if (none) L.push({ id: 'torso/shirts/sleeveless/torso_clothes_sleeveless2', mat: { cloth: topC } });
  else if (longS) L.push({ id: sp.collar ? 'torso/shirts/longsleeve/torso_clothes_longsleeve2_polo' : 'torso/shirts/longsleeve/torso_clothes_longsleeve2', mat: { cloth: topC } });
  else L.push({ id: sp.collar ? 'torso/shirts/shortsleeve/torso_clothes_shortsleeve_polo' : 'torso/shirts/shortsleeve/torso_clothes_tshirt', mat: { cloth: topC } });
  if (sp.trim && !longS && !kid && !sp.vestOver) L.push({ id: 'torso/shirts/sleeves/torso_clothes_shortsleeves2', mat: { cloth: cloth(sp.trim) } });
  if (sp.apron && !kid) { const def = getDef('torso/aprons/torso_aprons_apron'); L.push({ id: 'torso/aprons/torso_aprons_apron', variant: pickVariant(def, cloth(sp.apron)) }); }
  if (sp.shirt && sp.tie && !kid) X.push(['suit', 'red']);
  if (sp.zip && !sp.vestOver && sp.sleeve === 'long' && lumOf(sp.top) < 0.2 && !sp.apron) X.push(['leather', 'black']);
  if (sp.print && !kid) X.push(['print', sp.print.kind, 'white', !!sp.print.back]);
  if (sp.bandolier) X.push(['bandolier', lumOf(sp.bandolier) > 0.5 ? 'white' : 'charcoal']);
  if (sp.chain) X.push(['chain']);
  if (sp.scarf && sp.top && /f1a7c1/i.test(sp.scarf[0])) X.push(['rosaScarf']);
  else if (sp.scarf) X.push(['rosaScarf', cloth(sp.scarf[0]), cloth(sp.scarf[1])]);
  if (B.stripe || sp.sleeveStripe) X.push(['stripe']);
  // ----- hair, beard
  const hs = sp.hairStyle || 'short', hairHex = sp.hair || '#2a1c14', hairName = DYED.test(hairHex) ? dyedHair(hairHex) : naturalHair(hairHex), covered = sp.hat && sp.hat.type === 'scarf';
  if (!covered && !sp.hood) {
    let defs = kid ? HAIR_KID[fem ? 'f' : 'm'] : (fem && (hs === 'short' || hs === 'fade' || hs === 'buzz' || hs === 'quiff' || hs === 'comb' || hs === 'swept')) ? HAIR_FEM_SHORT : (HAIR[hs] || HAIR.short);
    if (old && hs === 'short') defs = fem ? HAIR_FEM_SHORT : ['hair/bald/hair_balding'];
    if (defs.length) { const d = defs[hashN(key, defs.length)]; L.push({ id: d, mat: { hair: hairName } }); }
  }
  const fb = sp.face && sp.face.beard, beardName = sp.face && sp.face.beardCol ? (DYED.test(sp.face.beardCol) ? dyedHair(sp.face.beardCol) : naturalHair(sp.face.beardCol)) : hairName;
  if (fb && BEARD[fb] && !kid) L.push({ id: BEARD[fb], mat: { hair: beardName } });
  if (sp.face && sp.face.stubble && !kid) X.push(['stubble']);
  // ----- glasses
  if (sp.glasses) { const g = sp.glasses; X.push([g.style === 'round' ? 'roundGlasses' : 'rectGlasses', g.style, g.tortoise]); }
  // ----- hats
  const h = sp.hat;
  if (h) { if (h.type === 'scarf') X.push(['fazzoletto', 'black']); else if (h.type === 'flatcap') X.push(['flatCap', cloth(h.col)]); else if (h.type === 'peaked') X.push(['peakedCap', lumOf(h.col) > 0.6 ? 'white' : 'navy', h.col2 && lumOf(h.col2) > 0.6 ? 'white' : 'yellow']); else if (h.type === 'straw') X.push(['strawHat', cloth(h.col), h.col2 ? cloth(h.col2) : 'red']); else if (h.type === 'helmet') X.push(['helmet', 'white']); else if (h.type === 'cap') X.push(['cap', cloth(h.col)]); else if (h.type === 'top') X.push(['topHat', 'black']); else if (h.type === 'hood') L.push({ id: 'headwear/coverings/hoods/hat_hood_cloth', mat: { cloth: cloth(h.col) } }); }
  // ----- skin art and small things
  if (sp.tattoo && (sp.sleeveTattoo || sp.tattooForearm)) X.push(['tattoo', 'arms']);
  if (sp.neckTattoo) X.push(['tattoo', 'neck']);
  if (B.ripped) X.push(['rip']);
  if (sp.earring) X.push(['earring']);
  // ----- carried
  if (sp.bag) X.push(['hold', 'bag', cloth(sp.bag), 'l']); if (sp.tote) X.push(['hold', 'bag', cloth(sp.tote), 'l']); if (sp.purse) X.push(['hold', 'purse', cloth(sp.purse), 'l']); if (sp.briefcase) X.push(['hold', 'briefcase', cloth(sp.briefcase), 'l']);
  if (sp.bag2) X.push(['hold', 'bag', cloth(sp.bag2), 'r']); if (sp.helmetHand) X.push(['hold', 'helmet', 'white', 'l']); if (sp.phone) X.push(['hold', 'phone', null, 'r']);
  if (sp.backpack) X.push(['backpack', cloth(sp.backpack)]);
  if (sp.drink) X.push(['drink', sp.drink.type, sp.drink.col ? cloth(sp.drink.col) : 'forest']);
  if (sp.dog) X.push(['dog', cloth(sp.dog)]);
  if (sp.stroller) X.push(['stroller', cloth(sp.stroller[0]), cloth(sp.stroller[1])]);
  if (sp.chair) X.push(['wheelchair', 'black', false]);
  return { id: sp.id, body, layers: L, extras: X, run: !!sp.run, sit: !!sp.sit, drink: !!sp.drink, chair: !!sp.chair, skinName: skin, noSit: kid || !!sp.chair };
}
const lumOf = h => { const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16); return (0.3 * r + 0.59 * g + 0.11 * b) / 255; };
