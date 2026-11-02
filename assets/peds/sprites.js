// The cast of the pedestrian crowd. Owned by the pedestrian work.
// TYPES are the Palermitan kinds of people (nonna, market vendor, tourist, rosanero fan, metalhead...) with their outfits and crowd weights per zone; the
// parametric character model (model.js) and the generator (people.js) turn each type into several different people, and VARIANTS is that list (the cast).
// Drawing lives in model.js / raster.js, the atlases in atlas.js.
import { makePerson, hashStr } from './people.js';
import { CELL_U } from './raster.js';
export const CELL_W = CELL_U.w, CELL_H = CELL_U.h, GROUND = CELL_U.ground;
export const POSES = 8, DIRS = 4, DIRS_DRAWN = 3;   // poses: idle, four walking, drink, sit (on the ground, knees up), sit and sip; directions: front, back, left, right (right is the mirror of left)
export const POSE_DRINK = 5, POSE_SIT = 6, POSE_SIT_SIP = 7;
export const CELLS_PER_ENTRY = DIRS_DRAWN * POSES;   // cell number inside an entry = direction * POSES + pose
export const FRONT = 0, BACK = 1, LEFT = 2, RIGHT = 3;

// leg/tor/head are heights in px (adult 19/14/10), tw torso width. bottom.type: trousers | shorts | skirt | robe. Night extras: drink {type,col}, headphones, pocket, sparkle, hat types cap/hood, pair [a, b] (a couple).
// the "falsi invalidi" gag: a tracksuit man in a wheelchair who leaps up and sprints off when the lapa comes near
const TRACK = { tw: 13, skin: '#c99872', hair: '#6b645c', hairStyle: 'short', glasses: '#18161a', top: '#b83a2c', sleeve: 'long', sleeveStripe: '#f0eee8', chain: '#d9b44a', bottom: { type: 'trousers', col: '#b83a2c', stripe: '#f0eee8' }, shoes: '#f0eee8' };
const AMICO1 = { skin: '#d9ab8a', hair: '#2e211a', hairStyle: 'swept', glasses: { frame: '#1e1a1a', style: 'rect', w: 1.85, h: 1.3, rim: 0.55 }, stubble: '#3a2a22', tw: 11, leg: 20,
  face: { fw: 4.2, jaw: 0.6, cheek: 0.3, chinW: 0.8, eyeGap: 1.95, eyeSize: 0.92, eyeTilt: 0.02, eyeShape: 'narrow', eyeCol: '#3a2a1c', browThick: 0.8, browTilt: 0.04, browArch: 0.08, noseLen: 1.35, noseW: 0.95, mouthW: 2.9, lip: 0.3, smile: 0.4, earSize: 0.9, stubbleD: 0.26, age: 0.3 } };
const AMICO2 = { skin: '#f0cdb2', hair: '#9a6038', hairStyle: 'curlylong', hairLen: 0, glasses: { frame: '#2a1a14', style: 'round', tortoise: true, w: 1.6, h: 1.6, rim: 0.38, tcol: '#5a3016' }, tw: 10, leg: 21, tor: 14, tattoo: '#3a4a5a', tattooForearm: true, bracelet: ['#d9443c', '#f0eee8', '#2a3f6b'],
  face: { fw: 4.1, jaw: 0.2, cheek: 0.25, chinW: 0.4, eyeGap: 2.0, eyeSize: 1.0, eyeShape: 'almond', eyeCol: '#5a6a4a', browThick: 0.45, browCol: '#9a6a44', browTilt: 0.02, noseLen: 1.5, noseW: 0.9, mouthW: 2.7, lip: 0.25, smile: 0.0, earSize: 0.9, age: 0.2, freckles: true } };
const TYPES = [
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
  // La Favorita and the lungomare: joggers (run animation) and dog walkers (the dog is drawn into the cell, see figure.js). Zero weight in the centro zones, profiles in src/pedestrians.js give them theirs.
  { id: 'jogger', run: true, skin: '#c99872', hair: '#1c1614', hairStyle: 'short', top: '#d9443c', sleeve: 'short', bottom: { type: 'shorts', col: '#26324a', len: 8 }, shoes: '#f0eee8', speed: 2.4 },
  { id: 'jogger2', run: true, skin: '#e0ae8c', hair: '#4a2a1a', hairStyle: 'bun', top: '#4fa9a0', sleeve: 'short', bottom: { type: 'trousers', col: '#26262e' }, shoes: '#e8553c', speed: 2.2 },
  { id: 'dogwalker', dog: '#a8743c', skin: '#d0a081', hair: '#8c8c8c', hairStyle: 'short', top: '#5a7a58', sleeve: 'long', bottom: { type: 'trousers', col: '#4a4640' }, shoes: '#3a2c24', speed: 0.9 },
  { id: 'dogwalker2', dog: '#ece6d8', stoop: 1, skin: '#d6a284', hair: '#c8c4bc', hairStyle: 'bun', top: '#b8607a', sleeve: 'long', bottom: { type: 'skirt', col: '#3a2f4a', len: 12 }, legCol: '#2f2b33', shoes: '#18161a', speed: 0.8 },
  { id: 'dogwalker3', dog: '#2a2622', skin: '#c99872', hair: '#17120f', hairStyle: 'fade', top: '#3f6bb0', sleeve: 'short', bottom: { type: 'shorts', col: '#c9b99a', len: 9 }, shoes: '#eeeeee', speed: 1.0 },
  // ---- the night (src/pedestrians.js swaps the crowd mix after dark): young people with drinks, a DJ-ish guy, couples
  { id: 'nightboy', skin: '#d0a081', hair: '#1a1512', hairStyle: 'fade', top: '#1f2330', sleeve: 'short', chain: '#d9b44a', bottom: { type: 'trousers', col: '#2a2e38' }, shoes: '#f0eee8', drink: { type: 'bottle', col: '#3f7a3a' }, speed: 1.0 },
  { id: 'nightboy2', skin: '#c99872', hair: '#2a1c14', hairStyle: 'quiff', top: '#f0eee8', sleeve: 'long', bottom: { type: 'trousers', col: '#4b6a96' }, shoes: '#6b4a30', drink: { type: 'glass', col: '#ee7a2a' }, speed: 1.0 },
  { id: 'nightgirl', skin: '#e0ae8c', hair: '#2a1a14', hairStyle: 'long', top: '#d9443c', sleeve: 'short', bottom: { type: 'skirt', col: '#1d1d24', len: 9 }, legCol: '#e0ae8c', shoes: '#17151a', drink: { type: 'glass', col: '#ee7a2a' }, speed: 1.0 },
  { id: 'nightgirl2', skin: '#d9a98a', hair: '#c8a03a', hairStyle: 'long', top: '#2f6bb0', sleeve: 'short', bottom: { type: 'trousers', col: '#17151a' }, shoes: '#f0eee8', drink: { type: 'glass', col: '#c8e07a' }, speed: 1.0 },
  { id: 'nightgirl3', skin: '#cf9d7c', hair: '#3a2418', hairStyle: 'bun', top: '#e87aa0', sleeve: 'short', bottom: { type: 'skirt', col: '#f0eee8', len: 10 }, legCol: '#cf9d7c', shoes: '#f0eee8', drink: { type: 'bottle', col: '#8a5a2a' }, speed: 1.0 },
  { id: 'dj', skin: '#c99872', hair: '#17120f', hairStyle: 'short', hat: { type: 'cap', col: '#17151a', back: true }, headphones: '#d9443c', glasses: '#18161a', top: '#17151a', sleeve: 'short', chain: '#d9b44a', bottom: { type: 'trousers', col: '#3a3a44' }, shoes: '#f0eee8', speed: 1.0 },
  { id: 'couple', pair: [
      { tw: 9, hw: 9, skin: '#d0a081', hair: '#1a1512', hairStyle: 'short', top: '#2f6b49', sleeve: 'short', bottom: { type: 'trousers', col: '#2a2e38' }, shoes: '#eeeeee' },
      { tw: 9, hw: 9, leg: 17, tor: 13, skin: '#e0ae8c', hair: '#2a1a14', hairStyle: 'long', top: '#e87aa0', sleeve: 'short', bottom: { type: 'skirt', col: '#35527d', len: 9 }, legCol: '#e0ae8c', shoes: '#f0eee8' }], leg: 19, speed: 0.8 },
  { id: 'couple2', pair: [
      { tw: 9, hw: 9, skin: '#c99872', hair: '#2a1c14', hairStyle: 'quiff', top: '#d9d4c6', sleeve: 'long', bottom: { type: 'trousers', col: '#35527d' }, shoes: '#6b4a30' },
      { tw: 9, hw: 9, leg: 17, tor: 13, skin: '#d9a98a', hair: '#c8a03a', hairStyle: 'long', top: '#4fa9a0', sleeve: 'short', bottom: { type: 'trousers', col: '#17151a' }, shoes: '#f0eee8' }], leg: 19, speed: 0.8 },
  // ---- scripted night characters (never in the crowd): the hooded guy of the Easter egg, the client of "A Favorita", the glam night folk of the avenue
  { id: 'hooded', skin: '#c99872', hair: '#17120f', hat: { type: 'hood', col: '#2b2d36' }, top: '#2b2d36', sleeve: 'long', pocket: true, bottom: { type: 'trousers', col: '#17151a' }, shoes: '#f0eee8', speed: 1.1 },
  { id: 'client', stoop: 1, skin: '#d4a584', hair: '#2a2420', hat: { type: 'straw', col: '#4a443a', col2: '#17151a' }, bigGlasses: '#0c0c10', top: '#b7a98a', collar: '#d8c9a2', sleeve: 'long', belt: '#6a5a3a', briefcase: '#17151a', bottom: { type: 'robe', col: '#b7a98a' }, shoes: '#2a2018', speed: 0.95 },
  { id: 'glam1', skin: '#e0ae8c', hair: '#e6c34a', hairStyle: 'long', bigGlasses: '#18161a', top: '#c9ccd8', sparkle: '#ffffff', sleeve: 'short', bottom: { type: 'skirt', col: '#c9ccd8', len: 15 }, legCol: '#e0ae8c', shoes: '#d9443c', purse: '#d9443c', speed: 0.9 },
  { id: 'glam2', skin: '#c99872', hair: '#17120f', hairStyle: 'long', top: '#d9443c', sparkle: '#ffd24a', sleeve: 'long', scarf: ['#f0eee8', '#e8559a'], bottom: { type: 'skirt', col: '#d9443c', len: 14 }, legCol: '#c99872', shoes: '#17151a', purse: '#17151a', speed: 0.9 },
  { id: 'glam3', skin: '#d9a98a', hair: '#e8559a', hairStyle: 'long', glasses: '#18161a', top: '#d9b44a', sparkle: '#fff4e0', sleeve: 'short', chain: '#ffffff', bottom: { type: 'trousers', col: '#f0eee8' }, shoes: '#7a3ab8', speed: 0.9 },
  // ---- the metal look (pubs at night, src/pedestrians.js spawnCrowd): long or curly hair, beards, band tees with made-up logos, vests with patches, leather, ripped black jeans, combat boots, tattoos
  { id: 'metal_long', age: 'young', hairStyle: 'long', hair: '#1c1614', top: '#17151a', sleeve: 'short', print: { col: '#d9d4c6', kind: 'letters', w: 8, h: 6, back: true, seed: 3 }, tattoo: '#2a3a4a', sleeveTattoo: true, tattooForearm: true, bracelet: ['#1a1a1e', '#8a8a92'],
    bottom: { type: 'trousers', col: '#17151a', ripped: true }, boots: '#1a1a1e', shoes: '#1a1a1e', drink: { type: 'bottle', col: '#3f7a3a' }, speed: 0.95, gen: true, styles: [['long', 4], ['wavy', 2], ['ponytail', 1.5], ['curly', 1.5]], beardP: 0.7 },
  { id: 'metal_vest', age: 'adult', hairStyle: 'ponytail', top: '#17151a', vest: '#3a4f6e', vestOver: true, patches: true, sleeve: 'short', print: { col: '#c8c4bc', kind: 'skull', w: 8, h: 6, seed: 5 }, tattoo: '#2a3a4a', sleeveTattoo: true, ring: true, bracelet: ['#1a1a1e', '#8a8a92'],
    bottom: { type: 'trousers', col: '#17151a', ripped: true }, boots: '#1a1a1e', shoes: '#1a1a1e', drink: { type: 'glass', col: '#ee9a2a' }, speed: 0.95, gen: true, styles: [['long', 3], ['ponytail', 3], ['bald', 1.2], ['curly', 1.5]], beardP: 0.8 },
  { id: 'metal_leather', age: 'adult', hairStyle: 'long', top: '#1c1a1e', sleeve: 'long', zip: true, shirt: '#17151a', print: { col: '#b8382c', kind: 'stripe', w: 8, h: 5, seed: 1 }, neckTattoo: true, tattoo: '#2a3a4a', ring: true,
    bottom: { type: 'trousers', col: '#17151a', ripped: true }, boots: '#1a1a1e', shoes: '#1a1a1e', drink: { type: 'bottle', col: '#8a5a2a' }, speed: 0.95, gen: true, styles: [['long', 3], ['wavy', 2], ['short', 1], ['comb', 1]], beardP: 0.6 },
  { id: 'metal_bald', age: 'adult', hairStyle: 'bald', top: '#17151a', sleeve: 'short', print: { col: '#d9d4c6', kind: 'letters', w: 9, h: 6, seed: 9 }, tattoo: '#2a3a4a', sleeveTattoo: true, tattooForearm: true, neckTattoo: true, tw: 13, earring: true,
    bottom: { type: 'trousers', col: '#26324a', jeans: true }, boots: '#1a1a1e', shoes: '#1a1a1e', drink: { type: 'glass', col: '#ee9a2a' }, speed: 0.95, gen: true, styles: [['bald', 5], ['buzz', 1.5]], beardP: 0.95 },
  { id: 'metal_f', age: 'young', sex: 'f', hairStyle: 'long', hair: '#17120f', top: '#17151a', sleeve: 'short', print: { col: '#d9d4c6', kind: 'skull', w: 7, h: 5, seed: 2 }, tattoo: '#2a3a4a', sleeveTattoo: true, earring: true, bracelet: ['#1a1a1e', '#8a8a92'],
    bottom: { type: 'skirt', col: '#17151a', len: 8 }, legCol: '#2a2430', boots: '#1a1a1e', shoes: '#1a1a1e', drink: { type: 'bottle', col: '#3f7a3a' }, speed: 0.95, gen: true, styles: [['long', 4], ['wavy', 2], ['ponytail', 1.5], ['bob', 1]] },
  { id: 'metal_f2', age: 'young', sex: 'f', hairStyle: 'wavy', top: '#17151a', vest: '#17151a', vestOver: true, sleeve: 'short', print: { col: '#c8c4bc', kind: 'letters', w: 7, h: 5, seed: 7 }, earring: true, tattoo: '#2a3a4a', sleeveTattoo: true,
    bottom: { type: 'trousers', col: '#17151a', ripped: true }, boots: '#1a1a1e', shoes: '#1a1a1e', drink: { type: 'glass', col: '#ee9a2a' }, speed: 0.95, gen: true, styles: [['wavy', 3], ['long', 3], ['bun', 1]] },
  // ---- cameo friends of the author (rare): faces and hair copied from photos, outfits vary. amico1: quiff, rectangular dark glasses, light stubble.
  // amico2: tall and slim, long wavy copper hair, round tortoiseshell glasses, forearm tattoos and wrist bracelets.
  ...[['giacca', { top: '#17151a', sleeve: 'long', zip: true, bottom: { type: 'trousers', col: '#3d5a86', jeans: true }, shoes: '#e8e6e0' }],
      ['rosanero', { top: '#f1a7c1', trim: '#17151a', collar: '#17151a', sleeve: 'short', scarf: ['#f1a7c1', '#17151a'], bottom: { type: 'trousers', col: '#26324a', jeans: true }, shoes: '#eeeeee' }],
      ['mercato', { top: '#ecebe6', sleeve: 'short', apron: '#1d1b20', bottom: { type: 'trousers', col: '#26324a' }, shoes: '#17151a' }],
      ['tuta', { top: '#26324a', sleeve: 'long', sleeveStripe: '#f0eee8', chain: '#d9b44a', bottom: { type: 'trousers', col: '#26324a', stripe: '#f0eee8' }, shoes: '#f0eee8' }],
      ['mondello', { top: '#f0eee8', sleeve: 'short', bottom: { type: 'shorts', col: '#3f9ab8', len: 8 }, shoes: '#a8684a' }]].flatMap(([k, o]) => [
    { id: 'amico1_' + k, ...AMICO1, ...o, speed: 1.1, gen: false },
    { id: 'amico2_' + k, ...AMICO2, ...o, speed: 1.1, gen: false }]),
  // the coachman of the tourist carrozze (src/carrozze.js puts him on the box): grey moustache, white shirt, black waistcoat, a top hat. Not part of the crowd (weight 0 below)
  { id: 'cocchiere', gen: false, age: 'adult', skin: '#c99872', hair: '#6b645c', hairStyle: 'short', face: { beard: 'moustache', beardCol: '#6b645c' }, top: '#f2f0e8', sleeve: 'long', waistcoat: '#17151a',
    hat: { type: 'top', col: '#17151a' }, bottom: { type: 'trousers', col: '#17151a' }, shoes: '#17151a', speed: 0.9 },
  // the carrettiere of the Sicilian cart (src/carrozze.js and src/carretto.js put him on the bench): flat cap, white moustache, rolled shirt, brown waistcoat. Not part of the crowd (weight 0 below)
  { id: 'carrettiere', gen: false, age: 'adult', skin: '#b98a62', hair: '#d8d4cc', hairStyle: 'short', face: { beard: 'moustache', beardCol: '#d8d4cc' }, top: '#ece4cf', sleeve: 'long', waistcoat: '#5a3320',
    hat: { type: 'flatcap', col: '#3b2a1e' }, bottom: { type: 'trousers', col: '#2f2a26' }, shoes: '#2a1c14', speed: 0.8 },
  // Summer and the sea. All of them have weight 0 in W below: the district and place profiles of src/pedestrians.js (WEAR, PROFILES) put them where they belong, and the bathers
  // and sunbathers of the beaches take swim_*. All adults. swim: the suit tools/lpc/cast.mjs cuts from existing LPC layers (trunks, a bandeau and briefs, a one-piece), in a colour
  // it picks per person, with the towel under the sitters; bare: no top (the generated renderer, ?pedgen, shows a skin coloured one).
  { id: 'swim_m', swim: 'trunks', bare: true, gen: true, age: 'young', sleeve: 'none', top: '#c99872', bottom: { type: 'shorts', col: '#2fa3c8', len: 7 }, shoes: '#a8684a', speed: 1.0 },
  { id: 'swim_w', swim: 'bikini', gen: true, sex: 'f', age: 'young', sleeve: 'none', top: '#d9443c', bottom: { type: 'shorts', col: '#d9443c', len: 3 }, legCol: '#d9a98a', shoes: '#a8684a', speed: 1.0, styles: [['long', 3], ['wavy', 2.5], ['ponytail', 2], ['bun', 2], ['bob', 1.5]] },
  { id: 'swim_w2', swim: 'onepiece', gen: true, sex: 'f', age: 'young', sleeve: 'none', top: '#2f6bb0', bottom: { type: 'shorts', col: '#2f6bb0', len: 3 }, legCol: '#d9a98a', shoes: '#a8684a', speed: 1.0, styles: [['long', 3], ['wavy', 2.5], ['ponytail', 2], ['bun', 2], ['bob', 1.5]] },
  { id: 'summer_m', sandals: true, gen: true, age: 'adult', sleeve: 'none', top: '#f0eee8', glasses: '#18161a', bottom: { type: 'shorts', col: '#c8b78e', len: 9 }, shoes: '#a8684a', speed: 1.1 },
  { id: 'summer_w', sandals: true, gen: true, sex: 'f', age: 'adult', sleeve: 'none', top: '#f0eee8', bottom: { type: 'skirt', col: '#3f9ab8', len: 9 }, legCol: '#d9a98a', shoes: '#a8684a', hat: { type: 'straw', col: '#e8dca8', col2: '#d9443c' }, speed: 1.1 },
];

// who is who: sex (default m) and age group (default adult); varyTop / varyBottom let the generator change the colours of the generic everyday types
const FEMALE = new Set(['swim_w', 'swim_w2', 'summer_w', 'nonna', 'nonna2', 'nonna3', 'signora', 'signora2', 'borsa', 'tifosa', 'shopper', 'motorina', 'mamma', 'beach_w', 'suora', 'teen2', 'kid2', 'jogger2', 'dogwalker2', 'nightgirl', 'nightgirl2', 'nightgirl3', 'glam1', 'glam2', 'vendor2', 'metal_f', 'metal_f2']);
const AGE = { kid: 'kid', kid2: 'kid', tifoso_kid: 'kid', scuola: 'kid', teen: 'teen', teen2: 'teen', ragazzo: 'young', ragazzo2: 'young', skinny: 'young', tuta: 'young', motorino: 'young', motorina: 'young', nightboy: 'young', nightboy2: 'young', nightgirl: 'young', nightgirl2: 'young', nightgirl3: 'young', dj: 'young', tifoso: 'young', tifosa: 'young', jogger: 'young', jogger2: 'young', hooded: 'young', glam1: 'young', glam2: 'young', glam3: 'young',
  nonna: 'old', nonna2: 'old', nonna3: 'old', nonno: 'old', nonno_gilet: 'old', coppola: 'old', coppola2: 'old', tifoso_nonno: 'old', dogwalker2: 'old', client: 'old', priest: 'old', suit2: 'old', beach_m: 'young', beach_w: 'young', cameriere: 'young', mamma: 'adult' };
const SIT_TYPES = new Set(['swim_m', 'swim_w', 'swim_w2']);   // people with a drink (the night and metal looks) and the swimmers (sunbathers on a towel) can sit on the ground; the LPC atlas holds the sit cells for them only, to keep its memory down
const VARY_TOP = new Set(['summer_m', 'summer_w', 'tourist', 'tourist2', 'teen', 'teen2', 'ragazzo', 'ragazzo2', 'borsa', 'signora', 'signora2', 'kid', 'kid2', 'shopper', 'mamma', 'motorino', 'motorina', 'skinny', 'nightboy', 'nightboy2', 'nightgirl', 'nightgirl2', 'nightgirl3', 'jogger', 'jogger2', 'dogwalker', 'dogwalker3', 'beach_w']);
const VARY_BOTTOM = new Set(['summer_m', 'teen', 'ragazzo', 'ragazzo2', 'motorino', 'skinny', 'nightboy2', 'nightgirl2', 'dogwalker', 'kid']);
for (const t of TYPES) { if (FEMALE.has(t.id)) t.sex = 'f'; if (!t.age) t.age = AGE[t.id] || 'adult'; if (VARY_TOP.has(t.id)) t.varyTop = true; if (VARY_BOTTOM.has(t.id)) t.varyBottom = true; if (t.id.startsWith('amico')) t.age = 'young'; }

// Crowd weights per zone: [vicoli, main street, market, tourist, match-day / Libertà-Politeama]
const W = {
  nonna: [6, 3, 8, 1.5, 2], coppola: [6, 4, 6, 2, 2], vendor: [0.5, 1, 9, 0.5, 0.3], tourist: [2, 6, 2, 12, 2], kid: [4, 3, 4, 3, 2], teen: [5, 6, 4, 4, 4], priest: [1, 1, 0.5, 3, 0.3],
  carabiniere: [0.6, 1.2, 0.5, 2, 1.5], signora: [3, 3, 3, 3, 3], suit: [3, 5, 1, 3, 3], nonno: [5, 2, 6, 2, 1], borsa: [5, 6, 6, 5, 4], ragazzo: [4, 5, 3, 4, 4], fruttivendolo: [0.5, 0.5, 7, 0.2, 0],
  signora2: [3, 3, 3, 3, 3], suit2: [1.5, 3, 0.5, 1.5, 2], teen2: [3, 4, 2, 3, 3], coppola2: [5, 3, 4, 1, 1], ragazzo2: [3, 4, 3, 3, 3], tourist2: [2, 5, 1, 10, 2], kid2: [3, 3, 3, 3, 2], vendor2: [0.5, 1, 8, 0.5, 0.3],
  tifoso: [4, 5, 2, 3, 14], tifoso2: [3, 4, 2, 2, 12], tifosa: [3, 4, 1, 2, 10], tifoso_kid: [2, 2, 1, 1, 6], tifoso_nonno: [1.5, 1.5, 1.5, 0.5, 5],
  tuta: [5, 4, 3, 2, 3], skinny: [4, 5, 3, 3, 3], motorino: [3, 2, 3, 1, 2], motorina: [2, 2, 2, 1, 2], nonno_gilet: [5, 2, 5, 1, 1], nonna2: [6, 3, 7, 1, 1.5], nonna3: [5, 2, 5, 1, 1],
  pescivendolo: [0.5, 0, 8, 0, 0], macellaio: [0.3, 0, 4, 0, 0], shopper: [2, 5, 3, 3, 3], beach_m: [0.5, 1.5, 0.5, 3, 0.5], beach_w: [0.5, 1.5, 0.5, 3, 0.5], mamma: [3, 3, 2, 2, 2],
  wheelchair: [0.5, 1.2, 2, 0.8, 0.3], healed: [0, 0, 0, 0, 0], chair_empty: [0, 0, 0, 0, 0], cocchiere: [0, 0, 0, 0, 0], carrettiere: [0, 0, 0, 0, 0],
  swim_m: [0, 0, 0, 0, 0], swim_w: [0, 0, 0, 0, 0], swim_w2: [0, 0, 0, 0, 0], summer_m: [0, 0, 0, 0, 0], summer_w: [0, 0, 0, 0, 0],   // the places add these (see the header of the summer types above)
  scuola: [2, 1, 1, 1, 1], suora: [1, 1, 0.3, 3, 0.2], vigile: [0.5, 1.5, 0.5, 1.5, 1.5], cameriere: [1, 3, 1, 3, 1],
};
// Zones: [vicoli, main street, market, tourist, match-day, movida]. Zone 5 only exists after dark (Sant'Anna, Vucciria).
// The night entries of W are the DAY weights of the night-only characters: zero. Their night weights are in NW below.
Object.assign(W, { jogger: [0, 0, 0, 0, 0], jogger2: [0, 0, 0, 0, 0], dogwalker: [0, 0, 0, 0, 0], dogwalker2: [0, 0, 0, 0, 0], dogwalker3: [0, 0, 0, 0, 0] });
Object.assign(W, { nightboy: [0, 0, 0, 0, 0], nightboy2: [0, 0, 0, 0, 0], nightgirl: [0, 0, 0, 0, 0], nightgirl2: [0, 0, 0, 0, 0], nightgirl3: [0, 0, 0, 0, 0], dj: [0, 0, 0, 0, 0], couple: [0, 0, 0, 0, 0], couple2: [0, 0, 0, 0, 0],
  hooded: [0, 0, 0, 0, 0], client: [0, 0, 0, 0, 0], glam1: [0, 0, 0, 0, 0], glam2: [0, 0, 0, 0, 0], glam3: [0, 0, 0, 0, 0] });
const NW = { nightboy: [3, 5, 3, 3, 2, 14], nightboy2: [3, 5, 3, 3, 2, 12], nightgirl: [3, 5, 3, 3, 2, 14], nightgirl2: [3, 5, 3, 3, 2, 12], nightgirl3: [2, 4, 2, 2, 2, 8], dj: [0, 0.3, 0, 0, 0, 1.2], couple: [2, 3, 1, 3, 1, 6], couple2: [2, 3, 1, 3, 1, 6] };
// everyone else after dark: day weight times this (default 1); vendors have gone home, tourists thin out
const NIGHT_MULT = { vendor: 0, vendor2: 0, fruttivendolo: 0, pescivendolo: 0, macellaio: 0, scuola: 0, tourist: 0.3, tourist2: 0.3, beach_m: 0.1, beach_w: 0.1, kid: 0.1, kid2: 0.1, mamma: 0.15,
  nonna: 0.25, nonna2: 0.25, nonna3: 0.25, nonno: 0.4, nonno_gilet: 0.4, coppola: 0.5, coppola2: 0.5, priest: 0.1, suora: 0.05, vigile: 0.2, suit: 0.3, suit2: 0.3, borsa: 0.8, signora: 0.7, signora2: 0.7,
  shopper: 0.4, tifoso: 0.5, tifoso2: 0.5, tifosa: 0.5, tifoso_kid: 0.1, tifoso_nonno: 0.3, cameriere: 2, teen: 1.6, teen2: 1.6, ragazzo: 1.6, ragazzo2: 1.6, skinny: 1.8, tuta: 1.6, motorino: 1.5, motorina: 1.5,
  carabiniere: 1.2, wheelchair: 0.1 };
const Z5 = { teen: 5, teen2: 5, ragazzo: 5, ragazzo2: 5, skinny: 5, tuta: 3, motorina: 2, motorino: 2, borsa: 2, shopper: 1, cameriere: 1.5, tourist: 1, tourist2: 1, carabiniere: 0.5, signora: 0.5, signora2: 0.5 };
// metal look: a few at night, the pubs ask for them by name; cameo friends: rare everywhere, a little commoner where their outfit fits (rosanero on match days, apron at the market, summer at the sea-ish tourist zone)
for (const n of [1, 2]) {
  Object.assign(W, { ['amico' + n + '_giacca']: [0.12, 0.15, 0.1, 0.12, 0.1], ['amico' + n + '_rosanero']: [0.1, 0.12, 0.05, 0.08, 0.5], ['amico' + n + '_mercato']: [0.1, 0.02, 0.45, 0.02, 0],
    ['amico' + n + '_tuta']: [0.12, 0.12, 0.08, 0.05, 0.1], ['amico' + n + '_mondello']: [0.05, 0.12, 0.05, 0.4, 0.05] });
  Object.assign(NW, { ['amico' + n + '_giacca']: [0.2, 0.3, 0.1, 0.2, 0.2, 1], ['amico' + n + '_tuta']: [0.2, 0.3, 0.1, 0.1, 0.2, 0.7], ['amico' + n + '_rosanero']: [0.08, 0.1, 0.03, 0.05, 0.3, 0.3] });
  Object.assign(NIGHT_MULT, { ['amico' + n + '_mercato']: 0, ['amico' + n + '_mondello']: 0.15 });
}
Object.assign(NW, { metal_long: [0.15, 0.25, 0.1, 0.1, 0.1, 0.9], metal_vest: [0.12, 0.2, 0.08, 0.08, 0.08, 0.7], metal_leather: [0.1, 0.2, 0.08, 0.08, 0.08, 0.6], metal_bald: [0.08, 0.15, 0.05, 0.05, 0.05, 0.5], metal_f: [0.1, 0.18, 0.06, 0.06, 0.06, 0.5], metal_f2: [0.1, 0.18, 0.06, 0.06, 0.06, 0.5] });
for (const id of ['metal_long', 'metal_vest', 'metal_leather', 'metal_bald', 'metal_f', 'metal_f2']) W[id] = [0, 0, 0, 0, 0];

// ---------- the cast ----------
// Every type becomes n different people (more for the common types), each built once by the generator with a fixed seed so the crowd looks the same on every load.
// A cast entry is the spec of one person plus what the crowd needs: id (its type), w / wn (day and night weights per zone, already divided by the entries of the type), n.
export const CAST_SIZE = 84;   // entries shared out by crowd weight; the minimums below come on top
const ENTRY_MIN = { swim_m: 4, swim_w: 4, swim_w2: 3, summer_m: 3, summer_w: 3, beach_m: 4, beach_w: 4, vendor: 3, vendor2: 3, fruttivendolo: 2, pescivendolo: 2, macellaio: 2, tifoso: 3, tifoso2: 3, tifosa: 3, tifoso_kid: 2, tifoso_nonno: 2, jogger: 2, jogger2: 2, dogwalker: 2, dogwalker2: 2, dogwalker3: 2, metal_long: 3, metal_vest: 3, metal_leather: 3, metal_bald: 2, metal_f: 3, metal_f2: 2, nightboy: 2, nightboy2: 2, nightgirl: 2, nightgirl2: 2, nightgirl3: 2, wheelchair: 1 };
const wsum = id => { const w = W[id] || [1, 1, 1, 1, 1], n = NW[id] || w.map((x, z) => x * (NIGHT_MULT[id] ?? 1)); return w.reduce((a, b) => a + b, 0) + n.reduce((a, b) => a + b, 0) * 0.6; };
export const VARIANTS = [];
{
  const tot = TYPES.reduce((a, t) => a + wsum(t.id), 0);
  for (const t of TYPES) {
    const n = t.gen === false || t.chair ? 1 : t.pair ? 2 : Math.max(ENTRY_MIN[t.id] || 1, Math.min(5, Math.round(CAST_SIZE * wsum(t.id) / tot)));
    const w = W[t.id] || [1, 1, 1, 1, 1], wz = [...w, w[3]], wn = NW[t.id] || w.map((x, z) => x * (NIGHT_MULT[t.id] ?? 1)).concat([Z5[t.id] || 0]);
    for (let k = 0; k < n; k++) {
      const seed = hashStr(t.id) + k * 7919;
      let sp;
      if (t.pair) sp = { ...t, pair: t.pair.map((p, i) => makePerson({ ...p, sex: i ? 'f' : 'm', age: 'young', gen: true }, k + i, seed + i * 101)), skin: '#000', top: '#000', bottom: { type: 'trousers', col: '#000' }, shoes: '#000', hair: '#000' };
      else { sp = makePerson(t, k, seed); if (t.bare) sp.top = sp.skin; }
      sp.n = n; sp.w = wz.map(x => x / n); sp.wn = wn.map(x => x / n);
      sp.sit = !sp.pair && !sp.dog && !sp.chair && !sp.stroller && !t.run && !(t.hat && (t.hat.type === 'peaked' || t.hat.type === 'helmet')) && (!!sp.drink || SIT_TYPES.has(t.id));   // can sit on the ground (spawnCrowd pose 'sit'): people with a drink and the young everyday types
      VARIANTS.push(sp);
    }
  }
}
export const ROWS = VARIANTS.length;
export const variantIndex = id => VARIANTS.findIndex(v => v.id === id);
export const variantsOf = id => { const r = []; for (let i = 0; i < VARIANTS.length; i++) if (VARIANTS[i].id === id) r.push(i); return r; };
