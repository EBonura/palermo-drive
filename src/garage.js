// Garage data: the seven vehicles, the tamarro parts catalogue, the fare wallet and the saved look. Owned by the driving work.
// Pure data and persistence (no three.js), so the shell (src/garage-ui.js) and the vehicle (src/vehicle.js) can both import it.
//
// Money: the "Turisti affamati" mode credits every paid fare by dispatching a 'pd-fare' window event ({ detail: { amount } },
// see the one-line hook in src/missions.js). The wallet persists in localStorage and is spent on vehicles and parts in the Garage.
// Test links: ?cash=500 (adds cash for this page load), ?own=all (everything unlocked, nothing saved),
// ?veh=vespa&liv=rosso&parts=spoiler:gt,neon:rosa,rims:spinner (forces the look for screenshots, nothing saved).

const KEY = 'palermoDrive.garage.v1';
const SETTINGS_KEY = 'palermoDrive.settings.v1';

// kind: 'lapa' (three wheels, tips), 'bike' (two wheels, leans, wheelies), 'car' (four wheels, grips)
export const VEHICLES = [
  { id: 'calessino', kind: 'lapa', name_it: 'Calessino', name_en: 'Calessino', sub_it: 'Il taxi dei turisti', sub_en: 'The tourist taxi', price: 0 },
  { id: 'cassone', kind: 'lapa', name_it: 'Lapa Cassone', name_en: 'Cargo lapa', sub_it: 'Cassoni di arance', sub_en: 'Crates of oranges', price: 30 },
  { id: 'lapa50', kind: 'lapa', name_it: 'Lapa 50', name_en: 'Lapa 50', sub_it: 'Il furgoncino', sub_en: 'The little van', price: 20 },
  { id: 'vespa', kind: 'bike', name_it: 'Vespa', name_en: 'Vespa', sub_it: 'Classica, rotonda', sub_en: 'Classic and round', price: 60 },
  { id: 'scooterone', kind: 'bike', name_it: 'Scooterone', name_en: 'Big-wheel scooter', sub_it: 'Ruote grandi, bauletto', sub_en: 'Big wheels, top box', price: 80 },
  { id: 'motorino', kind: 'bike', name_it: 'Motorino', name_en: 'Little motorbike', sub_it: 'Nudo, nervoso', sub_en: 'Naked and twitchy', price: 50 },
  { id: 'tascia', kind: 'car', name_it: 'Macchina tascia', name_en: 'Tamarro hatchback', sub_it: 'Bassa, rumorosa, tutta adesivi', sub_en: 'Low, loud, all stickers', price: 120 },
];
export const vehicleById = id => VEHICLES.find(v => v.id === id) || VEHICLES[0];

// Paint schemes per vehicle. The Calessino keeps its three original liveries; the others share a "rosanero" (Palermo pink and black).
// color is the swatch shown in the garage. Models read the matching entry in src/vehicle-models.js.
const P = (id, name_it, name_en, color) => ({ id, name_it, name_en, color });
const ROSANERO = P('rosanero', 'Rosanero', 'Pink and black', '#f08cb4');
export const LIVERIES = {
  calessino: [P('blu', 'Blu reale', 'Royal blue', '#1d4fd0'), P('bianco', 'Bianco e bordeaux', 'White and burgundy', '#f1efe8'), P('carretto', 'Carretto siciliano', 'Sicilian cart', '#f0c000'), ROSANERO],
  cassone: [P('verde', 'Verde fruttivendolo', 'Greengrocer green', '#4f8a55'), P('azzurro', 'Azzurro', 'Sky blue', '#6aa7d8'), P('giallo', 'Giallo limone', 'Lemon yellow', '#f0c92a'), ROSANERO],
  lapa50: [P('bianco', 'Bianco', 'White', '#f1efe8'), P('rosso', 'Rosso pomodoro', 'Tomato red', '#c9342a'), P('azzurro', 'Azzurro', 'Sky blue', '#6aa7d8'), ROSANERO],
  vespa: [P('menta', 'Verde menta', 'Mint green', '#8fd0b0'), P('crema', 'Crema', 'Cream', '#efe2bf'), P('rosso', 'Rosso', 'Red', '#c42f2a'), P('azzurro', 'Azzurro', 'Sky blue', '#5aa0d8'), ROSANERO],
  scooterone: [P('grigio', 'Grigio metallo', 'Metal grey', '#8e949b'), P('nero', 'Nero', 'Black', '#25262a'), P('perla', 'Bianco perla', 'Pearl white', '#f2f0ea'), P('rosso', 'Rosso', 'Red', '#c42f2a'), ROSANERO],
  motorino: [P('nero', 'Nero opaco', 'Matt black', '#2a2b2e'), P('rosso', 'Rosso', 'Red', '#c42f2a'), P('arancio', 'Arancio', 'Orange', '#ee7a1e'), P('verde', 'Verde acido', 'Acid green', '#9ad12e'), ROSANERO],
  tascia: [P('viola', 'Viola metallizzato', 'Metallic purple', '#7a3bc0'), P('arancio', 'Arancio sole', 'Sun orange', '#f07a14'), P('giallo', 'Giallo', 'Yellow', '#f2d020'), P('nero', 'Nero lucido', 'Gloss black', '#1b1b20'), ROSANERO],
};
export const defaultLivery = type => (LIVERIES[type] || LIVERIES.calessino)[0].id;

// Parts. Each option: id, names, price in euro. '' (empty) is always "stock" and free. kinds: which vehicle kinds can wear it.
const O = (id, name_it, name_en, price, extra = {}) => ({ id, name_it, name_en, price, ...extra });
export const PARTS = [
  { id: 'spoiler', name_it: 'Alettone', name_en: 'Spoiler', opts: [
    O('basso', 'Alettone basso', 'Lip spoiler', 12), O('gt', 'Alettone GT', 'GT wing', 25), O('gigante', 'Alettone gigante', 'Giant wing', 40)] },
  { id: 'neon', name_it: 'Neon sotto', name_en: 'Underglow', opts: [
    O('rosa', 'Rosa Palermo', 'Palermo pink', 15, { color: '#ff2f9e' }), O('ciano', 'Ciano', 'Cyan', 15, { color: '#18e6ff' }),
    O('verde', 'Verde acido', 'Acid green', 15, { color: '#37ff6a' }), O('viola', 'Viola', 'Violet', 15, { color: '#9b4dff' }),
    O('ambra', 'Ambra', 'Amber', 15, { color: '#ffb020' }), O('arcobaleno', 'Arcobaleno', 'Rainbow', 45, { color: '#ffffff' })] },
  { id: 'chrome', name_it: 'Cromature', name_en: 'Chrome', opts: [
    O('cromo', 'Cromature', 'Chrome trim', 22), O('oro', 'Dorature', 'Gold trim', 40)] },
  { id: 'rims', name_it: 'Cerchi', name_en: 'Rims', opts: [
    O('neri', 'Cerchi neri', 'Black rims', 15), O('cromati', 'Cerchi cromati', 'Chrome rims', 18), O('oro', 'Cerchi dorati', 'Gold rims', 30), O('spinner', 'Spinner', 'Spinners', 45)] },
  { id: 'stickers', name_it: 'Adesivi', name_en: 'Stickers', opts: [
    O('palermo', 'Palermo', 'Palermo', 10), O('rosanero', 'Strisce rosanero', 'Pink-black stripes', 10), O('trinacria', 'Trinacria', 'Trinacria', 15), O('fiamme', 'Fiamme', 'Flames', 15)] },
  { id: 'exhaust', name_it: 'Scarico', name_en: 'Exhaust', opts: [
    O('marmitta', 'Marmitta sportiva', 'Sport exhaust', 18), O('doppio', 'Doppio scarico', 'Twin exhaust', 35)] },
  { id: 'horn', name_it: 'Clacson', name_en: 'Horn', opts: [
    O('tarantella', 'Tarantella', 'Tarantella', 15), O('fanfara', 'Fanfara', 'Fanfare', 15), O('camion', 'Camion', 'Truck horn', 20)] },
  { id: 'sub', name_it: 'Subwoofer', name_en: 'Subwoofer', opts: [O('sub', 'Subwoofer', 'Subwoofer', 35)] },
];
export const partById = id => PARTS.find(p => p.id === id);

// ---------------------------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------------------------
const st = { type: 'calessino', liv: {}, parts: {}, owned: {}, cash: 0 };
let forced = false;       // test link overrides: nothing is saved
const listeners = new Set();
const params = typeof location === 'object' ? new URLSearchParams(location.search) : new URLSearchParams();

try {
  const s = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (s && typeof s === 'object') {
    if (VEHICLES.some(v => v.id === s.type)) st.type = s.type;
    if (s.liv && typeof s.liv === 'object') st.liv = s.liv;
    if (s.parts && typeof s.parts === 'object') st.parts = s.parts;
    if (s.owned && typeof s.owned === 'object') st.owned = s.owned;
    if (Number.isFinite(s.cash)) st.cash = Math.max(0, s.cash);
  } else { // first run: keep the livery the old garage saved
    const old = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (old && typeof old.livery === 'string' && LIVERIES.calessino.some(l => l.id === old.livery)) st.liv.calessino = old.livery;
  }
} catch (e) { /* storage unavailable: defaults */ }

function save() {
  if (forced) return;
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* storage unavailable */ }
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
  const l = params.get('liv'); if (l) st.liv[st.type] = l;
  if (params.has('parts')) {
    st.parts = {};
    for (const kv of params.get('parts').split(',')) { const [k, o] = kv.split(':'); if (k && o && partById(k)) st.parts[k] = o; }
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
  liveryOf(type = st.type) { const list = LIVERIES[type] || LIVERIES.calessino; return list.some(l => l.id === st.liv[type]) ? st.liv[type] : list[0].id; },
  get parts() { return st.parts; },
  // the look the vehicle wears: { type, livery, parts: { spoiler: 'gt', ... } }
  look() { return { type: st.type, livery: this.liveryOf(), parts: { ...st.parts } }; },
  ownsVehicle(id) { const v = vehicleById(id); return v.price === 0 || !!st.owned[ownedKey.v(id)]; },
  ownsPart(part, opt) { return !opt || !!st.owned[ownedKey.p(part, opt)]; },
  partPrice(part, opt) { const p = partById(part); const o = p && p.opts.find(x => x.id === opt); return o ? o.price : 0; },
  // everything below changes the saved state and notifies listeners
  setVehicle(id) { if (!VEHICLES.some(v => v.id === id)) return; st.type = id; save(); emit(); },
  setLivery(id, type = st.type) { st.liv[type] = id; save(); emit(); },
  setPart(part, opt) { if (opt) st.parts[part] = opt; else delete st.parts[part]; save(); emit(); },
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
  debit(amount) { amount = Math.min(Math.max(0, Math.round(+amount) || 0), st.cash); if (amount > 0) { st.cash -= amount; save(); emit(); } return amount; },
  credit(amount) { if (amount > 0 && Number.isFinite(amount)) { st.cash += amount; save(); emit(); } },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  // which parts a look wears that the player does not own (test links and previews): used by the garage to warn
  forced: () => forced,
};

// Hook for src/missions.js: every paid fare is credited here.
if (typeof addEventListener === 'function') addEventListener('pd-fare', e => { const a = e.detail && e.detail.amount; if (a > 0) garage.credit(a); });

// A look from outside (garage preview or a remote player): fills defaults and drops junk.
export function cleanLook(l) {
  const type = l && VEHICLES.some(v => v.id === l.type) ? l.type : 'calessino';
  const list = LIVERIES[type], livery = l && list.some(x => x.id === l.livery) ? l.livery : list[0].id, parts = {};
  if (l && l.parts) for (const p of PARTS) { const o = l.parts[p.id]; if (o && p.opts.some(x => x.id === o)) parts[p.id] = o; }
  return { type, livery, parts };
}
export const lookKey = l => `${l.type}|${l.livery}|${PARTS.map(p => (l.parts && l.parts[p.id]) || '').join(',')}`;
