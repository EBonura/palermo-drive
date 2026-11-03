// Tree species by area (board item n4). The baked tree items carry a species only where OSM or the monumental register says so (`ge`, `sp`, `lt`, `kd`); everything else
// (lidar crowns, CTR points, the Urban Atlas lattice, the procedural park, piazza and street trees) gets one here from where it stands:
//   1. an explicit species or genus (OSM species / genus tags, the monumental register) wins;
//   2. the leaf type (OSM leaf_type: needleleaved, palm, broadleaved) and the CTR kind hint (`kd`: tall = palm-like crown, fruit = orchard symbol, olive, pine) narrow the choice;
//   3. otherwise a weighted mix by place: a named park or garden, the avenue, the district (src/districts.js zoneAt), the height above the sea and the land use around.
// The mixes are design values read off the aerials and the street photos (Via della Liberta is planes, the Foro Italico palms and ficus, the Favorita stone and Aleppo pines and
// holm oak, the Conca d'Oro citrus, the hills olive and carob and Aleppo pine); the weights are not measurements. Pure functions, deterministic per position.
export const SP = {
  // code: [model, tint hex or null, crown sizes it can have: s small (< 2.1 m radius), m, l (> 4.2 m)]
  plane: ['plane', null, 'ml'], ficus: ['ficus', null, 'ml'], stone: ['pine', null, 'ml'], aleppo: ['aleppo', null, 'ml'],
  carob: ['tree', '#7f9a74', 'ml'], holm: ['holm', null, 'm'], olive: ['tree', '#a9b48a', 'sm'], citrus: ['orange', null, 'sm'], oleander: ['shrub', null, 's'],
  canary: ['palm_date', null, 't'], wash: ['palm_fan', null, 't'],
};

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const hash01 = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

// weights by place
const MIX = {
  foro: { canary: 28, wash: 20, ficus: 18, plane: 10, stone: 8, oleander: 8, citrus: 4, carob: 4 },                     // the Foro Italico seafront and Villa a Mare
  botanic: { ficus: 26, wash: 16, plane: 14, canary: 12, stone: 8, citrus: 8, holm: 6, carob: 4, oleander: 6 },        // Villa Giulia, the Orto Botanico
  marina: { ficus: 60, wash: 10, canary: 8, plane: 10, oleander: 6, citrus: 6 },                                         // Giardino Garibaldi, Piazza Marina
  villa: { ficus: 20, canary: 16, wash: 12, plane: 16, stone: 8, citrus: 10, holm: 6, carob: 4, oleander: 8 },          // the villa gardens: Trabia, Malfitano, Giardino Inglese, Bonanno...
  favorita: { stone: 26, aleppo: 20, holm: 22, carob: 8, canary: 6, wash: 5, ficus: 4, plane: 4, citrus: 3, olive: 2 },
  mondello: { stone: 18, canary: 14, wash: 10, aleppo: 12, citrus: 10, ficus: 8, oleander: 12, carob: 6, plane: 4, olive: 3, holm: 3 },
  lido: { canary: 32, wash: 26, oleander: 14, stone: 10, ficus: 6, citrus: 4, plane: 4, aleppo: 4 },                      // the Mondello promenade
  viaLib: { plane: 48, ficus: 14, wash: 6, canary: 5, citrus: 8, oleander: 6, carob: 5, stone: 3 },
  avenue: { plane: 38, oleander: 26, canary: 8, ficus: 8, carob: 8, citrus: 6, stone: 3, wash: 3 },                      // Viale Regione Siciliana and the other wide avenues
  oldAv: { plane: 30, ficus: 16, citrus: 14, wash: 8, carob: 10, oleander: 8, canary: 5, stone: 5, olive: 4 },          // Corso Calatafimi, Corso dei Mille, the 1960s grid
  centro: { ficus: 22, citrus: 26, plane: 10, wash: 12, canary: 8, carob: 12, olive: 4 },                               // the old town: no pines or shrubs (they would only add draw calls: one per model per cell)
  suburb: { citrus: 22, olive: 14, carob: 20, ficus: 10, plane: 8, canary: 6, wash: 8, aleppo: 6, oleander: 6 },
  rural: { olive: 28, carob: 24, citrus: 16, aleppo: 14, stone: 6, holm: 8, ficus: 2, oleander: 2 },
  hill: { aleppo: 38, olive: 24, carob: 18, holm: 10, stone: 6, citrus: 2, oleander: 2 },
  orchard: { citrus: 78, olive: 8, carob: 6, ficus: 3, plane: 2, oleander: 3 },                                          // OSM orchards on the low land: the Conca d'Oro groves
  orchardHill: { olive: 50, carob: 24, aleppo: 10, holm: 8, citrus: 8 },
};
const OLD_AV = new Set(['calat', 'corsoMille', 'sacco', 'resut', 'fiera', 'zisa', 'noce', 'oreto', 'brancaccio', 'brin', 'politeama']);
const CENTRO = new Set(['old', 'alberg', 'kalsa', 'roma', 'corso', 'centro', 'borgoV', 'stazione', 'porto']);
const SUBURB = new Set(['zen', 'cep', 'cruillas', 'uditore', 'rigano', 'periph', 'tn', 'sferra', 'acquasanta', 'arenella']);

// named gardens: [x, z, radius]
const GARDENS = {
  botanic: [[1257, 247, 150], [1105, 467, 175]],
  marina: [[679, -217, 85]],
  villa: [[-1187, -1591, 170], [-1708, -864, 150], [-1637, -2501, 100], [-1262, -2384, 90], [-2005, -2977, 90], [-1551, -426, 70], [-531, 367, 90], [-1628, -111, 110], [-2845, 1797, 170],
    [-2957, -1577, 150], [-3587, -1312, 130], [-827, -1879, 140], [-912, -1736, 100], [-1100, -1500, 120], [-837, -553, 90]],
};
// the Foro Italico: a strip along the sea from the Cala to Villa a Mare, [x0, z0, x1, z1, half width]
const FORO = [900, -420, 1460, 260, 130];
const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.min(1, Math.max(0, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };

// the weights for a place: zone is the districts.js zone, y the ground height, land the land use around ('orchard', 'farm', 'forest', 'scrub', 'green' or '')
function mixAt(x, z, y, zone, land) {
  let m = null;
  if (segDist(x, z, FORO[0], FORO[1], FORO[2], FORO[3]) < FORO[4]) m = MIX.foro;
  else for (const [k, list] of Object.entries(GARDENS)) { for (const [gx, gz, r] of list) if (Math.hypot(x - gx, z - gz) < r) { m = MIX[k]; break; } if (m) break; }
  const hill = sstep(45, 130, y);
  if (!m) {
    if (land === 'orchard') m = hill > 0.5 ? MIX.orchardHill : MIX.orchard;
    else if (zone === 'favorita') m = MIX.favorita;
    else if (zone === 'lido') m = MIX.lido;
    else if (zone === 'mondello' || zone === 'valdesi') m = MIX.mondello;
    else if (zone === 'viaLib') m = MIX.viaLib;
    else if (zone === 'avenue') m = MIX.avenue;
    else if (OLD_AV.has(zone)) m = MIX.oldAv;
    else if (CENTRO.has(zone)) m = MIX.centro;
    else if (SUBURB.has(zone)) m = MIX.suburb;
    else m = MIX.rural;
    if (hill > 0.35 && !(zone === 'favorita' || zone === 'mondello' || zone === 'valdesi' || zone === 'lido' || zone === 'viaLib' || zone === 'avenue')) m = MIX.hill;
  }
  // the Conca d'Oro: the low land south and west of the city, in the fields and on the edge of the suburbs, is citrus
  const conca = (z > 1500 || (x < -3200 && z > -2200)) && y < 220 && (zone === 'rural' || zone === 'periph' || zone === 'brancaccio' || zone === 'corsoMille' || zone === 'cep' || land === 'farm');
  return { m, conca, hill };
}

// code of the species for a tree. it: the baked item ({kd, ge, sp, lt, r, h}) or null; land: the land use polygon around it
export function speciesFor(x, z, y, zone, it = null, land = '') {
  const ge = it && it.ge || '', sp = it && it.sp || '', s = ge + ' ' + sp, u = hash01(x * 0.731 + 3.1, z * 0.913 + 5.7);
  const { m, conca, hill } = mixAt(x, z, y, zone, land);
  // 1. the explicit species
  if (/Ficus/.test(s)) return 'ficus';
  if (/Phoenix/.test(s)) return 'canary';
  if (/Washingtonia|Trachycarpus|Chamaerops|Livistona/.test(s)) return 'wash';
  if (/Platanus/.test(s)) return 'plane';
  if (/Citrus/.test(s)) return 'citrus';
  if (/Olea/.test(s)) return 'olive';
  if (/Ceratonia/.test(s)) return 'carob';
  if (/Nerium/.test(s)) return 'oleander';
  if (/Quercus/.test(s)) return 'holm';
  if (/halepensis/.test(s)) return 'aleppo';
  if (land === 'olive') return u < 0.88 ? 'olive' : 'carob';   // a CTR olive grove
  if (/Pinus pinea|pinea/.test(s)) return 'stone';
  // 2. the kind of crown
  const kd = it && it.kd || '', lt = it && it.lt || '', r = it && it.r || 0;
  const pick = (allow) => {
    let tot = 0;
    for (const k in m) if (allow(k)) tot += m[k] * (k === 'citrus' && conca ? 3 : k === 'aleppo' ? 1 + 2 * hill : k === 'plane' || k === 'ficus' ? 1 - 0.5 * hill : 1);
    let t = u * tot;
    let last = null;
    for (const k in m) {
      if (!allow(k)) continue;
      last = k;
      t -= m[k] * (k === 'citrus' && conca ? 3 : k === 'aleppo' ? 1 + 2 * hill : k === 'plane' || k === 'ficus' ? 1 - 0.5 * hill : 1);
      if (t <= 0) return k;
    }
    return last || 'carob';
  };
  const palm = k => k === 'canary' || k === 'wash';
  if (kd === 'tall' || lt === 'palm') {   // a palm: the seafronts and the villa gardens lean to the Canary palm, the streets to the fan palm
    const canary = zone === 'lido' || zone === 'mondello' || zone === 'valdesi' || (m === MIX.foro) || m === MIX.villa ? 0.55 : 0.4;
    return hash01(x * 1.7 + 11, z * 0.37 + 2) < canary ? 'canary' : 'wash';
  }
  if (kd === 'olive') return 'olive';
  if (kd === 'citrus') return 'citrus';
  if (kd === 'pine' || lt === 'needleleaved') return hill > 0.3 && zone !== 'favorita' ? 'aleppo' : (zone === 'favorita' || zone === 'mondello' || zone === 'valdesi' || zone === 'lido' || m === MIX.villa) ? (u < 0.5 ? 'stone' : 'aleppo') : u < 0.7 ? 'aleppo' : 'stone';
  if (kd === 'fruit') return conca || land === 'orchard' || (y < 200 && hill < 0.5) ? 'citrus' : u < 0.7 ? 'olive' : 'carob';   // an orchard symbol: citrus in the lowland, olive and carob on the hills
  // 3. by place, restricted to the crown sizes that fit
  const size = r ? (r < 2.1 ? 's' : r > 4.2 ? 'l' : 'm') : 'm';
  if (lt === 'broadleaved') return pick(k => !palm(k) && SP[k][2].includes(size) && k !== 'aleppo' && k !== 'stone');
  return pick(k => !palm(k) && SP[k][2].includes(size) && (r || k !== 'oleander'));
}
