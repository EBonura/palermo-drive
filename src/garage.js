// Garage data: the seven bases, the customisation catalogue, the fare wallet and the saved setup of each base. Owned by the driving work.
// Pure data and persistence (no three.js), so the shell (src/garage-ui.js) and the vehicle (src/vehicle.js) can both import it.
//
// The garage works in two steps: choose a BASE vehicle (VEHICLES), then customise it by category (CATEGORIES -> PARTS, LIVERIES).
// Every base remembers its own paint and parts (st.cfg[base]); the last base you used is the one you drive. Parts you buy stay
// yours and can be fitted to any base they apply to (partOpts).
//
// Money: the "Turisti affamati" mode credits every paid fare by dispatching a 'pd-fare' window event ({ detail: { amount } },
// see the one-line hook in src/missions.js). The wallet persists in localStorage and is spent on vehicles and parts in the Garage.
// The wallet can be in debt: charge() (the pen sellers, src/event-penna.js) takes the whole sum even when it is not there. Nothing can be bought while it is below the price, fines and
// thefts (debit) take nothing from a wallet at or below zero, and fares pay the debt off first.
// Test links: ?cash=500 (adds cash for this page load), ?own=all (everything unlocked, nothing saved),
// ?veh=vespa&liv=rosso&parts=spoiler:gt,neon:rosa,rims:spinner (forces the look for screenshots, nothing saved).
// A custom colour is a livery id "c" + body hex, optionally "-" + trim hex: ?liv=cc42f2a-f2f0ea

const KEY = 'palermoDrive.garage.v1';        // the save format is versioned inside the payload (ver 2: per-base setups)
const SETTINGS_KEY = 'palermoDrive.settings.v1';

// kind: 'lapa' (three wheels, tips), 'bike' (two wheels, leans, wheelies), 'car' (four wheels, grips)
// stats: speed, acceleration and grip out of 10, read off the handling presets in src/vehicle.js (top gear speed, first gear thrust, lateral grip).
const V = (id, kind, name_it, name_en, sub_it, sub_en, price, stats, desc_it, desc_en) => ({ id, kind, name_it, name_en, sub_it, sub_en, price, stats, desc_it, desc_en });
export const VEHICLES = [
  V('calessino', 'lapa', 'Calessino', 'Calessino', 'Il taxi dei turisti', 'The tourist taxi', 0, [6, 6, 5],
    'Scarrozza i turisti da Quattro Canti al Foro Italico, musica a palla.', 'Carries tourists from Quattro Canti to Foro Italico, music blasting.'),
  V('cassone', 'lapa', 'Lapa Cassone', 'Cargo lapa', 'Cassoni di arance', 'Crates of oranges', 30, [4, 4, 4],
    'Cassoni di arance e limoni: lenta, carica e pronta a ribaltarsi.', 'Crates of oranges and lemons: slow, loaded and ready to tip over.'),
  V('lapa50', 'lapa', 'Lapa 50', 'Lapa 50', 'Il furgoncino', 'The little van', 20, [4, 5, 4],
    'Il furgoncino di Ballarò: piccolo, svelto e sempre in ritardo.', 'The Ballarò market van: small, quick and always late.'),
  V('vespa', 'bike', 'Vespa', 'Vespa', 'Classica, rotonda', 'Classic and round', 60, [6, 7, 6],
    'Mezza Palermo ci va al mare: rotonda, scattante, pronta all\'impennata.', 'Half of Palermo rides one to the beach: round, nippy, ready to wheelie.'),
  V('scooterone', 'bike', 'Scooterone', 'Big-wheel scooter', 'Ruote grandi, bauletto', 'Big wheels, top box', 80, [8, 4, 7],
    'Ruote grandi e bauletto: si mangia le buche e non si ferma mai.', 'Big wheels and a top box: eats potholes and never slows down.'),
  V('motorino', 'bike', 'Motorino', 'Little motorbike', 'Nudo, nervoso', 'Naked and twitchy', 50, [9, 9, 7],
    'Il cinquantino nervoso: due ruote, zero pazienza, mille impennate.', 'The twitchy little bike: two wheels, zero patience, a thousand wheelies.'),
  V('tascia', 'car', 'Macchina tascia', 'Tamarro hatchback', 'Bassa, rumorosa, tutta adesivi', 'Low, loud, all stickers', 120, [9, 8, 9],
    'La tamarra: bassa, rumorosa, bassi nel baule e adesivi ovunque.', 'The tamarro special: low, loud, bass in the boot and stickers everywhere.'),
];
// Event-only vehicles: not in the garage, never saved as your vehicle (the "corse clandestine" night event swaps one in).
export const EVENT_VEHICLES = [{ id: 'sulky', kind: 'horse', name_it: 'Calesse da corsa', name_en: 'Racing sulky', price: 0 }];
export const vehicleById = id => VEHICLES.find(v => v.id === id) || EVENT_VEHICLES.find(v => v.id === id) || VEHICLES[0];

// Paint presets per vehicle. The Calessino keeps its three original liveries; the others share a "rosanero" (Palermo pink and black).
// color is the swatch shown in the garage. Models read the matching entry in src/vehicle-art.js. Paint is free.
const P = (id, name_it, name_en, color) => ({ id, name_it, name_en, color });
const ROSANERO = P('rosanero', 'Rosanero', 'Pink and black', '#f08cb4');
export const LIVERIES = {
  calessino: [P('blu', 'Blu reale', 'Royal blue', '#1d4fd0'), P('bianco', 'Bianco e bordeaux', 'White and burgundy', '#f1efe8'), P('carretto', 'Carretto siciliano', 'Sicilian cart', '#f0c000'), ROSANERO,
    P('verde', 'Verde Conca d\'Oro', 'Conca d\'Oro green', '#2f7a52'), P('rosso', 'Rosso ciliegia', 'Cherry red', '#c42f2a'), P('nero', 'Nero e oro', 'Black and tan', '#25262a')],
  cassone: [P('verde', 'Verde fruttivendolo', 'Greengrocer green', '#4f8a55'), P('azzurro', 'Azzurro', 'Sky blue', '#6aa7d8'), P('giallo', 'Giallo limone', 'Lemon yellow', '#f0c92a'), ROSANERO,
    P('rosso', 'Rosso', 'Red', '#c9342a'), P('arancio', 'Arancio', 'Orange', '#ee7a1e'), P('crema', 'Crema', 'Cream', '#efe2bf')],
  lapa50: [P('bianco', 'Bianco', 'White', '#f1efe8'), P('rosso', 'Rosso pomodoro', 'Tomato red', '#c9342a'), P('azzurro', 'Azzurro', 'Sky blue', '#6aa7d8'), ROSANERO,
    P('verde', 'Verde', 'Green', '#4f8a55'), P('giallo', 'Giallo', 'Yellow', '#f0c92a'), P('nero', 'Nero e oro', 'Black and gold', '#25262a')],
  vespa: [P('menta', 'Verde menta', 'Mint green', '#8fd0b0'), P('crema', 'Crema', 'Cream', '#efe2bf'), P('rosso', 'Rosso', 'Red', '#c42f2a'), P('azzurro', 'Azzurro', 'Sky blue', '#5aa0d8'), ROSANERO,
    P('nero', 'Nero', 'Black', '#25262a'), P('giallo', 'Giallo', 'Yellow', '#f0c92a'), P('bianco', 'Bianco', 'White', '#f2f0ea')],
  scooterone: [P('grigio', 'Grigio metallo', 'Metal grey', '#8e949b'), P('nero', 'Nero', 'Black', '#25262a'), P('perla', 'Bianco perla', 'Pearl white', '#f2f0ea'), P('rosso', 'Rosso', 'Red', '#c42f2a'), ROSANERO,
    P('blu', 'Blu notte', 'Night blue', '#1d3f8a'), P('verde', 'Verde bosco', 'Forest green', '#2f6b4a'), P('oro', 'Oro', 'Gold', '#c9a23a')],
  motorino: [P('nero', 'Nero opaco', 'Matt black', '#2a2b2e'), P('rosso', 'Rosso', 'Red', '#c42f2a'), P('arancio', 'Arancio', 'Orange', '#ee7a1e'), P('verde', 'Verde acido', 'Acid green', '#9ad12e'), ROSANERO,
    P('bianco', 'Bianco', 'White', '#f2f0ea'), P('blu', 'Blu', 'Blue', '#1d4fd0'), P('viola', 'Viola', 'Violet', '#7a3bc0')],
  sulky: [P('baio', 'Baio', 'Bay', '#7a4a2a'), P('sauro', 'Sauro', 'Chestnut', '#a8582a'), P('morello', 'Morello', 'Black', '#26262a'), P('grigio', 'Grigio', 'Grey', '#aaaaaa')],
  tascia: [P('viola', 'Viola metallizzato', 'Metallic purple', '#7a3bc0'), P('arancio', 'Arancio sole', 'Sun orange', '#f07a14'), P('giallo', 'Giallo', 'Yellow', '#f2d020'), P('nero', 'Nero lucido', 'Gloss black', '#1b1b20'), ROSANERO,
    P('rosso', 'Rosso', 'Red', '#c9342a'), P('azzurro', 'Azzurro elettrico', 'Electric blue', '#2aa6e0'), P('bianco', 'Bianco', 'White', '#f2f0ea')],
};
export const defaultLivery = type => (LIVERIES[type] || LIVERIES.calessino)[0].id;

// Custom colours: the body and the details (trim) picked from a palette. The id carries both colours, so it travels in the look unchanged.
export const PALETTE = [
  P('rosso', 'Rosso', 'Red', '#c42f2a'), P('arancio', 'Arancio', 'Orange', '#ee7a1e'), P('giallo', 'Giallo', 'Yellow', '#f2d020'), P('lime', 'Lime', 'Lime', '#9ad12e'),
  P('verde', 'Verde', 'Green', '#2f7a52'), P('turchese', 'Turchese', 'Teal', '#17a398'), P('azzurro', 'Azzurro', 'Sky blue', '#3aa0e0'), P('blu', 'Blu', 'Blue', '#1d4fd0'),
  P('viola', 'Viola', 'Violet', '#7a3bc0'), P('fucsia', 'Fucsia', 'Fuchsia', '#e8559a'), P('rosa', 'Rosa', 'Pink', '#f08cb4'), P('bordeaux', 'Bordeaux', 'Burgundy', '#7a1830'),
  P('bianco', 'Bianco', 'White', '#f2f0ea'), P('grigio', 'Grigio', 'Grey', '#8e949b'), P('nero', 'Nero', 'Black', '#1b1b20'), P('oro', 'Oro', 'Gold', '#c9a23a'),
];
const HEX = /^[0-9a-f]{6}$/;
export const isCustomLivery = id => typeof id === 'string' && /^c[0-9a-f]{6}(-[0-9a-f]{6})?$/.test(id);
// '#rrggbb' pair of a custom id (trim may be null = the base's own), or null for a preset
export const parseLivery = id => isCustomLivery(id) ? { body: '#' + id.slice(1, 7), trim: id.length > 8 ? '#' + id.slice(8, 14) : null } : null;
export const customLivery = (body, trim) => 'c' + String(body).replace('#', '').toLowerCase() + (trim && HEX.test(String(trim).replace('#', '').toLowerCase()) ? '-' + String(trim).replace('#', '').toLowerCase() : '');
const validLivery = (type, id) => (LIVERIES[type] || LIVERIES.calessino).some(l => l.id === id) || (type !== 'sulky' && isCustomLivery(id));

// ---------------------------------------------------------------------------------------------
// Parts. Each part has options (id, names, price in euro); '' (empty) is always "stock" and free.
// Where it fits: part.kinds / option.kinds (vehicle kinds), option.only / option.not (vehicle ids).
// ---------------------------------------------------------------------------------------------
const O = (id, name_it, name_en, price, extra = {}) => ({ id, name_it, name_en, price, ...extra });
const LC = ['lapa', 'car'], BIKE = ['bike'];
export const PARTS = [
  { id: 'rims', name_it: 'Cerchi', name_en: 'Rims', opts: [
    O('neri', 'Cerchi neri', 'Black rims', 15), O('cromati', 'Cerchi cromati', 'Chrome rims', 18), O('oro', 'Cerchi dorati', 'Gold rims', 30),
    O('spinner', 'Spinner', 'Spinners', 45), O('rosa', 'Cerchi rosa', 'Pink rims', 20), O('bianchi', 'Cerchi bianchi', 'White rims', 16)] },
  { id: 'stance', name_it: 'Assetto', name_en: 'Suspension', kinds: LC, opts: [
    O('basso', 'Ribassato', 'Lowered', 20), O('raso', 'Rasoterra', 'Slammed', 35), O('alto', 'Rialzato', 'Lifted', 25)] },
  { id: 'chrome', name_it: 'Cromature', name_en: 'Trim', opts: [
    O('cromo', 'Cromature', 'Chrome trim', 22), O('oro', 'Dorature', 'Gold trim', 40), O('nero', 'Nero lucido', 'Gloss black', 18), O('rosa', 'Rosa Palermo', 'Palermo pink', 20)] },
  { id: 'exhaust', name_it: 'Scarico', name_en: 'Exhaust', opts: [
    O('marmitta', 'Marmitta sportiva', 'Sport exhaust', 18), O('doppio', 'Doppio scarico', 'Twin exhaust', 35),
    O('tromba', 'Tromba', 'Trumpet', 38), O('oro', 'Doppio dorato', 'Gold twin', 55)] },
  { id: 'spoiler', name_it: 'Alettone', name_en: 'Spoiler', opts: [
    O('basso', 'Alettone basso', 'Lip spoiler', 12), O('gt', 'Alettone GT', 'GT wing', 25), O('gigante', 'Alettone gigante', 'Giant wing', 40),
    O('anatra', 'Coda d\'anatra', 'Ducktail', 18), O('biplano', 'Biplano', 'Biplane', 48)] },
  { id: 'neon', name_it: 'Neon sotto', name_en: 'Underglow', opts: [
    O('rosa', 'Rosa Palermo', 'Palermo pink', 15, { color: '#ff2f9e' }), O('ciano', 'Ciano', 'Cyan', 15, { color: '#18e6ff' }),
    O('verde', 'Verde acido', 'Acid green', 15, { color: '#37ff6a' }), O('viola', 'Viola', 'Violet', 15, { color: '#9b4dff' }),
    O('ambra', 'Ambra', 'Amber', 15, { color: '#ffb020' }), O('arcobaleno', 'Arcobaleno', 'Rainbow', 45, { color: '#ffffff' })] },
  { id: 'stickers', name_it: 'Adesivi', name_en: 'Stickers', opts: [
    O('palermo', 'Palermo', 'Palermo', 10), O('rosanero', 'Strisce rosanero', 'Pink-black stripes', 10), O('trinacria', 'Trinacria', 'Trinacria', 15),
    O('fiamme', 'Fiamme', 'Flames', 15), O('scacchi', 'Scacchi', 'Chequers', 12), O('numero', 'Numero da corsa', 'Race number', 12)] },
  { id: 'horn', name_it: 'Clacson', name_en: 'Horn', opts: [
    O('tarantella', 'Tarantella', 'Tarantella', 15), O('fanfara', 'Fanfara', 'Fanfare', 15), O('camion', 'Camion', 'Truck horn', 20),
    O('mandolino', 'Mandolino', 'Mandolin', 18), O('bip', 'Bip bip', 'Beep beep', 12)] },
  { id: 'roof', name_it: 'Sul tetto', name_en: 'On the roof', opts: [
    O('megafono', 'Megafono', 'Loudspeaker', 30, { kinds: LC }), O('insegna', 'Insegna taxi', 'Taxi sign', 25, { kinds: LC }), O('antenna', 'Antenna e bandierina', 'Aerial and pennant', 14)] },
  { id: 'load', name_it: 'Carico', name_en: 'Load', kinds: LC, opts: [
    O('casse', 'Casse', 'Crates', 22), O('valigie', 'Valigie', 'Suitcases', 20), O('materasso', 'Materasso', 'Mattress', 16)] },
  { id: 'box', name_it: 'Borse', name_en: 'Luggage', kinds: BIKE, opts: [
    O('bauletto', 'Bauletto', 'Top box', 25, { not: ['scooterone'] }), O('borse', 'Borse laterali', 'Saddlebags', 28)] },
  { id: 'screen', name_it: 'Cupolino', name_en: 'Windscreen', kinds: BIKE, opts: [
    O('basso', 'Cupolino basso', 'Flyscreen', 14), O('alto', 'Cupolino alto', 'Tall screen', 20)] },
  { id: 'sub', name_it: 'Subwoofer', name_en: 'Subwoofer', opts: [O('sub', 'Subwoofer', 'Subwoofer', 35)] },
  // The two endgame upgrades (floats: drive on the sea, src/vehicle-water.js; wings: fly, src/vehicle-air.js). Far dearer than anything else (the next dearest part is 55, the dearest vehicle 120),
  // so they take real play to earn. Fitted like any part (per base), so "None" switches them off. hint_*: the line under the section name in the Garage.
  { id: 'swim', name_it: 'Mare', name_en: 'Sea', hint_it: 'Guida sull\'acqua', hint_en: 'Drive on the sea', opts: [O('galleggianti', 'Galleggianti e fuoribordo', 'Floats and outboard', 250)] },
  { id: 'fly', name_it: 'Cielo', name_en: 'Sky', hint_it: 'Tieni F per salire', hint_en: 'Hold F to climb', opts: [O('ali', 'Ali', 'Wings', 600)] },
];
export const partById = id => PARTS.find(p => p.id === id);
const fits = (x, v) => (!x.kinds || x.kinds.includes(v.kind)) && (!x.only || x.only.includes(v.id)) && !(x.not && x.not.includes(v.id));
// the options of a part that fit a base (empty when the whole part does not apply)
export const partOpts = (part, typeId) => { const p = partById(part), v = vehicleById(typeId); return p && fits(p, v) && v.kind !== 'horse' ? p.opts.filter(o => fits(o, v)) : []; };
export const partApplies = (typeId, part, opt) => partOpts(part, typeId).some(o => o.id === opt);

// The customisation tabs. 'paint' is the colour screen (presets and custom colours); the others list parts, with a section per part.
export const CATEGORIES = [
  { id: 'paint', name_it: 'Colore', name_en: 'Paint', paint: true },
  { id: 'wheels', name_it: 'Ruote', name_en: 'Wheels', parts: ['rims'] },
  { id: 'stance', name_it: 'Assetto', name_en: 'Stance', parts: ['stance'] },
  { id: 'trim', name_it: 'Cromi', name_en: 'Trim', parts: ['chrome'] },
  { id: 'exhaust', name_it: 'Scarico', name_en: 'Exhaust', parts: ['exhaust'] },
  { id: 'spoiler', name_it: 'Alettone', name_en: 'Spoiler', parts: ['spoiler'] },
  { id: 'neon', name_it: 'Neon', name_en: 'Neon', parts: ['neon'] },
  { id: 'stickers', name_it: 'Adesivi', name_en: 'Stickers', parts: ['stickers'] },
  { id: 'horn', name_it: 'Clacson', name_en: 'Horn', parts: ['horn'] },
  { id: 'extra', name_it: 'Extra', name_en: 'Extras', parts: ['roof', 'load', 'box', 'screen', 'sub'] },
  { id: 'upgrade', name_it: 'Mare e cielo', name_en: 'Sea and sky', parts: ['swim', 'fly'] },
];
// the tabs a base shows: paint always, the others only when something fits
export const categoriesFor = typeId => CATEGORIES.filter(c => c.paint || c.parts.some(p => partOpts(p, typeId).length));

// ---------------------------------------------------------------------------------------------
// State: st.cfg[base] = { liv, parts } is the saved setup of each base; st.type is the base you drive
// ---------------------------------------------------------------------------------------------
const st = { type: 'calessino', cfg: {}, owned: {}, cash: 0 };
let forced = false;       // test link overrides: nothing is saved
const listeners = new Set();
const params = typeof location === 'object' ? new URLSearchParams(location.search) : new URLSearchParams();

const cleanParts = (type, parts) => {
  const out = {};
  if (parts && typeof parts === 'object') for (const p of PARTS) { const o = parts[p.id]; if (typeof o === 'string' && partApplies(type, p.id, o)) out[p.id] = o; }
  return out;
};
const cfgOf = type => st.cfg[type] || (st.cfg[type] = { liv: defaultLivery(type), parts: {} });
for (const v of VEHICLES) cfgOf(v.id);

try {
  const s = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (s && typeof s === 'object') {
    if (VEHICLES.some(v => v.id === s.type)) st.type = s.type;
    if (s.owned && typeof s.owned === 'object') st.owned = s.owned;
    if (Number.isFinite(s.cash)) st.cash = s.cash;   // a debt is kept (charge below)
    if (s.cfg && typeof s.cfg === 'object') {              // ver 2: a setup per base
      for (const v of VEHICLES) { const c = s.cfg[v.id]; if (c && typeof c === 'object') st.cfg[v.id] = { liv: validLivery(v.id, c.liv) ? c.liv : defaultLivery(v.id), parts: cleanParts(v.id, c.parts) }; }
    } else {                                               // ver 1: one livery per vehicle and one set of parts worn by whatever you drove
      if (s.liv && typeof s.liv === 'object') for (const v of VEHICLES) if (validLivery(v.id, s.liv[v.id])) cfgOf(v.id).liv = s.liv[v.id];
      if (s.parts && typeof s.parts === 'object') cfgOf(st.type).parts = cleanParts(st.type, s.parts);
    }
  } else { // first run: keep the livery the old garage saved
    const old = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (old && typeof old.livery === 'string' && LIVERIES.calessino.some(l => l.id === old.livery)) cfgOf('calessino').liv = old.livery;
  }
} catch (e) { /* storage unavailable or damaged: defaults */ }

function save() {
  if (forced) return;
  try { localStorage.setItem(KEY, JSON.stringify({ ver: 2, type: st.type, cfg: st.cfg, owned: st.owned, cash: st.cash })); } catch (e) { /* storage unavailable */ }
}
const emit = () => { for (const f of listeners) { try { f(); } catch (e) { console.warn('garage listener', e); } } };

if (params.has('cash')) st.cash += Math.max(0, +params.get('cash') || 0);
if (params.get('own') === 'all') {
  forced = true;
  for (const v of VEHICLES) st.owned['v:' + v.id] = 1;
  for (const p of PARTS) for (const o of p.opts) st.owned[`p:${p.id}:${o.id}`] = 1;
}
if (params.has('veh') || params.has('liv') || params.has('parts')) {
  forced = true;
  const v = params.get('veh'); if (v && VEHICLES.some(x => x.id === v)) st.type = v;
  const l = params.get('liv'); if (l && validLivery(st.type, l)) cfgOf(st.type).liv = l;
  if (params.has('parts')) {
    const raw = {};
    for (const kv of params.get('parts').split(',')) { const [k, o] = kv.split(':'); if (k && o && partById(k)) raw[k] = o; }
    cfgOf(st.type).parts = cleanParts(st.type, raw);
  }
}

const ownedKey = {
  v: id => 'v:' + id,
  p: (part, opt) => `p:${part}:${opt}`,
};
export const garage = {
  get type() { return st.type; },
  get cash() { return st.cash; },
  get vehicle() { return vehicleById(st.type); },
  liveryOf(type = st.type) { return cfgOf(type).liv; },
  partsOf(type = st.type) { return cfgOf(type).parts; },
  get parts() { return cfgOf(st.type).parts; },
  // the look a base wears: { type, livery, parts: { spoiler: 'gt', ... } }; look() is the base you drive
  lookOf(type) { return { type, livery: this.liveryOf(type), parts: { ...cfgOf(type).parts } }; },
  look() { return this.lookOf(st.type); },
  ownsVehicle(id) { const v = vehicleById(id); return v.price === 0 || !!st.owned[ownedKey.v(id)]; },
  ownsPart(part, opt) { return !opt || !!st.owned[ownedKey.p(part, opt)]; },
  partPrice(part, opt) { const p = partById(part); const o = p && p.opts.find(x => x.id === opt); return o ? o.price : 0; },
  // everything below changes the saved state and notifies listeners
  setVehicle(id) { if (!VEHICLES.some(v => v.id === id)) return; st.type = id; save(); emit(); },
  setLivery(id, type = st.type) { if (!validLivery(type, id)) return; cfgOf(type).liv = id; save(); emit(); },
  setPart(part, opt, type = st.type) { if (opt && partApplies(type, part, opt)) cfgOf(type).parts[part] = opt; else delete cfgOf(type).parts[part]; save(); emit(); },
  buyVehicle(id) {
    const v = vehicleById(id); if (this.ownsVehicle(id)) return true;
    if (st.cash < v.price) return false;
    st.cash -= v.price; st.owned[ownedKey.v(id)] = 1; save(); emit(); return true;
  },
  buyPart(part, opt) {
    if (this.ownsPart(part, opt)) return true;
    const pr = this.partPrice(part, opt); if (st.cash < pr) return false;
    st.cash -= pr; st.owned[ownedKey.p(part, opt)] = 1; save(); emit(); return true;
  },
  // Fines (src/police.js): takes at most what the wallet holds and returns what was actually taken.
  debit(amount) { amount = Math.min(Math.max(0, Math.round(+amount) || 0), Math.max(0, st.cash)); if (amount > 0) { st.cash -= amount; save(); emit(); } return amount; },
  // A price that is paid whatever the wallet holds (src/event-penna.js): the wallet may go below zero. Returns what was taken.
  charge(amount) { amount = Math.max(0, Math.round(+amount) || 0); if (amount > 0) { st.cash -= amount; save(); emit(); } return amount; },
  credit(amount) { if (amount > 0 && Number.isFinite(amount)) { st.cash += amount; save(); emit(); } },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  // which parts a look wears that the player does not own (test links and previews): used by the garage to warn
  forced: () => forced,
};

// Hook for src/missions.js: every paid fare is credited here.
if (typeof addEventListener === 'function') addEventListener('pd-fare', e => { const a = e.detail && e.detail.amount; if (a > 0) garage.credit(a); });

// A look from outside (garage preview or a remote player): fills defaults and drops junk (including parts that do not fit the base).
export function cleanLook(l) {
  const type = l && (VEHICLES.some(v => v.id === l.type) || l.type === 'sulky') ? l.type : 'calessino';
  const list = LIVERIES[type], livery = l && validLivery(type, l.livery) ? l.livery : list[0].id;
  return { type, livery, parts: type === 'sulky' ? {} : cleanParts(type, l && l.parts) };
}
export const lookKey = l => `${l.type}|${l.livery}|${PARTS.map(p => (l.parts && l.parts[p.id]) || '').join(',')}`;
