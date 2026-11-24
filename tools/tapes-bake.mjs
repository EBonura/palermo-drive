// Bakes the road point of every cassette tape (src/tapes.js) into src/tapes-data.js, so every player finds a tape in the same spot:
//   node tools/tapes-bake.mjs            bake: writes x, z (game metres, 0.1 m) next to each tape's place lat/lon and prints the street and the distance from the place
//   node tools/tapes-bake.mjs --check    only check that src/tapes-data.js still matches the tiles (exit 1 if a baked point moved)
// Works offline from world/tiles: it builds the game's own traffic graph (src/traffic-graph.js) from the tiles round each place (the 3 x 3 tiles) and takes, in TAPES order,
// the drivable node (one on a street a car really drives: residential or bigger, no pedestrian street, service lane or alley) nearest the place that is at least MIN_GAP from the tapes before it. Run it again after a tile rebake.
// Needs tools/build/node_modules (three.js).
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'src/tapes-data.js'), CHECK = process.argv.includes('--check'), MIN_GAP = 40;
const THREE_DIR = path.join(HERE, 'build/node_modules/three/');
if (!fs.existsSync(THREE_DIR)) { console.error('missing ' + THREE_DIR + ': run npm install in tools/build'); process.exit(1); }
register('data:text/javascript,' + encodeURIComponent(`
const T = ${JSON.stringify('file://' + THREE_DIR)};
export async function resolve(s, c, n) {
  if (s === 'three') return { url: T + 'build/three.module.js', shortCircuit: true };
  if (s.startsWith('three/addons/')) return { url: T + 'examples/jsm/' + s.slice(13), shortCircuit: true };
  return n(s, c);
}`));
const stub = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : stub(), apply: () => stub(), construct: () => stub() });
globalThis.window = globalThis; globalThis.document = stub(); globalThis.addEventListener ??= () => {};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.PALERMO_DATA = { bounds: [0, 0, 0, 0], buildings: [], roads: [] };
const { proj } = await import('../src/core.js');
const { createGraph } = await import('../src/traffic-graph.js');
const { TAPES } = await import('../src/tapes-data.js');

const G = createGraph(), T = 500, loaded = new Set();
const load = (i, j) => {
  const k = i + '_' + j; if (loaded.has(k)) return; loaded.add(k);
  const f = path.join(ROOT, 'world/tiles', k + '.json'); if (!fs.existsSync(f)) return;
  const t = G.addTile(k, JSON.parse(fs.readFileSync(f, 'utf8')).roads || [], i * T, j * T); G.stepTile(t, 1e9);
};
const edgesOf = i => [...G.NOUT[i], ...G.NIN[i]].filter(e => !e.ped);
const street = i => edgesOf(i).some(e => !e.svc && e.rank >= 2);   // a street a car really drives; a service lane or a living street (courtyards, alleys) costs ALLEY m more
const ALLEY = 100;
const placed = [], rows = [];
for (const t of TAPES) {
  const [px, pz] = proj(t.lat, t.lon);
  for (let i = Math.floor(px / T) - 1; i <= Math.floor(px / T) + 1; i++) for (let j = Math.floor(pz / T) - 1; j <= Math.floor(pz / T) + 1; j++) load(i, j);
  let best = -1, bc = Infinity;
  for (let n = 0; n < G.NX.length; n++) {
    if (!G.NOUT[n] || !edgesOf(n).length) continue;
    const d = Math.hypot(G.NX[n] - px, G.NZ[n] - pz), c = d + (street(n) ? 0 : ALLEY);
    if (c < bc && placed.every(o => Math.hypot(o[0] - G.NX[n], o[1] - G.NZ[n]) >= MIN_GAP)) { bc = c; best = n; }
  }
  if (best < 0) { console.error('no road point for ' + t.id); process.exit(1); }
  const x = Math.round(G.NX[best] * 10) / 10, z = Math.round(G.NZ[best] * 10) / 10;
  placed.push([x, z]);
  const es = edgesOf(best).sort((a, b) => b.rank - a.rank), name = (es.find(e => e.name) || {}).name || '(no name)';
  rows.push({ ...t, x, z, street: name, d: Math.hypot(G.NX[best] - px, G.NZ[best] - pz) });
}
console.log('tape | street | m from place | x, z');
for (const r of rows) console.log(r.id.replace('sessanta-', ''), '|', r.street, '|', r.d.toFixed(0), '|', r.x, r.z);
if (CHECK) { const bad = rows.filter(r => r.x !== TAPES.find(t => t.id === r.id).x || r.z !== TAPES.find(t => t.id === r.id).z); console.log(bad.length ? 'MOVED: ' + bad.map(r => r.id).join(' ') : 'tapes-data.js matches the tiles'); process.exit(bad.length ? 1 : 0); }
const q = s => "'" + s.replace(/'/g, "\\'") + "'";
let js = fs.readFileSync(OUT, 'utf8').split('export const TAPES')[0];
js += 'export const TAPES = [   // id, title, short, place, lat, lon (the place), x, z (the road point, game metres: tools/tapes-bake.mjs)\n';
for (const r of rows) js += `  { id: ${q(r.id)}, title: ${q(r.title)}, short: ${q(r.short)}, place: ${q(r.place)}, lat: ${r.lat}, lon: ${r.lon}, x: ${r.x}, z: ${r.z} },\n`;
fs.writeFileSync(OUT, js + '];\n');
console.log('wrote ' + OUT);
