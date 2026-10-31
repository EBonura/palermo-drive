// District model for the whole city: which neighbourhood a building belongs to, and what that neighbourhood looks like
// (palettes, style mix, storeys, ground floors, roofs, decay). Pure data and functions, no three.js, so it can be tested in node.
// Photo sources and the reasoning behind each zone are in docs/districts.md. Owned by the district work (see docs/AGENTS.md).
//
// Zone fields
//   plaster, stone  hex palettes (multiplied up by buildings.js, so roughly albedo / 1.15), pStone = chance a palazzo shows bare tufa
//   grime           0..1 soot and weathering (vertex colour darkening and desaturation)
//   w               style weights: bar n19 res pw (centro styles) and lib blk ins pal fish ind
//   elig            true: weights are filtered by storey count and footprint (new zones); the centro zones keep their old behaviour
//   fl              [[storeys, weight], ...] storey distribution used where the baked height is only the generic estimate
//   fh              floor-to-floor height in metres for those estimates
//   gl              ground-floor mix for low/residential styles, [[tile, weight], ...]
//   roof            multiplier on the chance of a pitched tile roof
//   ruin            chance a small building is a bombed shell / rubble lot instead

const K = Math.cos(38.11572 * Math.PI / 180) * 111320; // same local projection as core.js (origin Quattro Canti)
const proj = (la, lo) => [(lo - 13.36126) * K, -(la - 38.11572) * 110540];

export const ZONES = {
  // ---------------- centro storico (unchanged from the original calibration) ----------------
  corso: { plaster: ['#e0d4b8', '#d6c6a6', '#cdbba0', '#d3b8a2', '#c7a58b', '#e4d9c2', '#c8b08c', '#d9c9a8', '#cfa890'], stone: ['#b79d74', '#c2aa82', '#a88e66', '#b8a07a'], pStone: 0.3, grime: 0.25,
    w: { bar: .3, n19: .5, res: .08, pw: .12 } },
  roma: { plaster: ['#cfc3ab', '#c4b59b', '#d2c7b0', '#bdae96', '#c9b79e', '#b9ad9b', '#d6cab4'], stone: ['#b5a68a', '#a89a80'], pStone: 0.2, grime: 0.3,
    w: { bar: .15, n19: .5, res: .05, pw: .3 } },
  old: { plaster: ['#cdb690', '#c8aa84', '#bf9f7c', '#d3c096', '#c49f7c', '#b9a587', '#d6c4a0', '#b98f72', '#c9b8a0', '#d0b9a2'], stone: ['#9d8560', '#a98f68', '#8f7a58', '#b49a74'], pStone: 0.45, grime: 0.6,
    w: { bar: .06, n19: .16, res: .66, pw: .12 } },
  politeama: { plaster: ['#e2d6bd', '#d8c4a0', '#d3a98f', '#c5b49c', '#c9a49a', '#e6dcc8', '#d9ccb0', '#bba898'], stone: ['#b9a07a'], pStone: 0.1, grime: 0.15,
    w: { bar: .06, n19: .4, res: .2, pw: .34 } },
  centro: { plaster: ['#dccfb2', '#d2c2a2', '#c9b79c', '#d0b49c', '#c4a288', '#e0d5bd', '#c4ac88', '#d6c6a4'], stone: ['#b09870', '#bfa67e', '#a58b64'], pStone: 0.3, grime: 0.4,
    w: { bar: .1, n19: .3, res: .45, pw: .15 } },

  // ---------------- centro storico quarters that need their own mix ----------------
  // Kalsa: tufa-grey and ochre plaster stripped to the stone, wartime gaps, Liberty and baroque palazzi mixed with plain houses.
  kalsa: { plaster: ['#c8b08a', '#bfa47e', '#cdb894', '#b99c7a', '#d0bc98', '#b48f70', '#c4ab8c', '#a89478'], stone: ['#9d8560', '#a98f68', '#8f7a58', '#b49a74'], pStone: 0.5, grime: 0.7, elig: true,
    w: { bar: .12, n19: .16, res: .5, pw: .08, blk: .06, lib: .04 }, fl: [[2, 1], [3, 3], [4, 3], [5, 2]], fh: 3.9, ruin: 0.07, roof: 0.8 },
  // Albergheria and Ballaro: yellow-ochre and pale plaster, peeling, post-war infill and ruins.
  alberg: { plaster: ['#c7a373', '#d0b07a', '#c0a07c', '#d8c48a', '#b99c78', '#cfa888', '#c4b090', '#d9c9a4'], stone: ['#a98f68', '#9d8560', '#b49a74'], pStone: 0.4, grime: 0.7, elig: true,
    w: { bar: .06, n19: .12, res: .56, pw: .12, blk: .1, lib: .04 }, fl: [[2, 1], [3, 3], [4, 3], [5, 2], [6, .5]], fh: 3.6, ruin: 0.06, roof: 0.8 },

  // ---------------- Liberta, Politeama, the sacco di Palermo belt ----------------
  // Via della Liberta itself: Liberty villini and 19th c. palazzi among 7 to 10 storey blocks of the 1960s-70s.
  viaLib: { plaster: ['#dcc9a2', '#d3a98a', '#e0d2b4', '#c8ab88', '#e6dcc6', '#d6b07a', '#d9b894', '#c0a68c', '#e0c58c'], stone: ['#bba07a', '#c4aa84'], pStone: 0.1, grime: 0.3, elig: true,
    w: { n19: .2, lib: .16, bar: .03, res: .04, blk: .42, pw: .1, pal: .05 }, fl: [[3, 1], [4, 2], [5, 2], [6, 2], [7, 3], [8, 3], [9, 2], [10, 1]], fh: 3.3, roof: 0.3 },
  // The grid behind it (Notarbartolo, Strasburgo, Principe di Paterno): orange, cream and terracotta blocks with stacked continuous balconies.
  sacco: { plaster: ['#d6a468', '#e0cfa8', '#d8b090', '#cfc4ae', '#c98f62', '#e6dcc4', '#dccb92', '#e8e2d2', '#bfa98a', '#d9a070'], stone: ['#bba07a'], pStone: 0.03, grime: 0.35, elig: true,
    w: { blk: .46, pal: .16, pw: .14, n19: .1, lib: .04, res: .1 }, fl: [[4, 1], [5, 2], [6, 3], [7, 3], [8, 3], [9, 2], [10, 1], [12, .4]], fh: 3.1, roof: 0.1 },
  resut: { plaster: ['#e4d8b8', '#e0cfa8', '#d8c8a8', '#e8e2d2', '#d2bda0', '#e0b890', '#cfc4ae', '#d9d0b8'], stone: ['#bba07a'], pStone: 0.02, grime: 0.28, elig: true,
    w: { pal: .34, blk: .26, pw: .14, res: .18, lib: .04, n19: .04 }, fl: [[3, 2], [4, 3], [5, 3], [6, 2], [7, 1.5], [8, .6]], fh: 3.1, roof: 0.2 },
  fiera: { plaster: ['#e0d4b8', '#d8c8a8', '#e8e2d2', '#cfc4ae', '#d6b890', '#e4dcc8'], stone: ['#bba07a'], pStone: 0.02, grime: 0.3, elig: true,
    w: { blk: .3, pal: .25, pw: .2, n19: .1, ind: .06, res: .09 }, fl: [[3, 1], [4, 2], [5, 3], [6, 3], [7, 2], [8, 1]], fh: 3.1, roof: 0.15 },

  // ---------------- Borgo Vecchio, Noce, Zisa, Cuba ----------------
  borgoV: { plaster: ['#c9b48e', '#c4a67e', '#d0bc98', '#b99c7a', '#cfb08c', '#bfa88a', '#d6c4a0', '#b48f70', '#c4b8a4'], stone: ['#a98f68', '#9d8560'], pStone: 0.22, grime: 0.62, elig: true,
    w: { res: .5, n19: .22, pw: .13, blk: .1, bar: .03, lib: .02 }, fl: [[2, 1], [3, 3], [4, 3], [5, 2], [6, .5]], fh: 3.4, roof: 0.4 },
  noce: { plaster: ['#d0c4a8', '#c9b79c', '#d8c8a8', '#bfb09a', '#d2b890', '#c8a888', '#e0d4b8', '#b8a890'], stone: ['#a98f68'], pStone: 0.1, grime: 0.5, elig: true,
    w: { pw: .28, blk: .24, res: .24, n19: .14, pal: .08, ind: .02 }, fl: [[3, 1], [4, 3], [5, 3], [6, 2], [7, 1]], fh: 3.2, roof: 0.3 },
  zisa: { plaster: ['#cbb890', '#c4ac84', '#d6c4a0', '#bfae94', '#d0b896', '#c8c0ac', '#b99c7a', '#d9ccb0'], stone: ['#a98f68', '#9d8560'], pStone: 0.3, grime: 0.6, elig: true,
    w: { res: .38, pw: .22, blk: .14, n19: .1, ind: .1, pal: .06 }, fl: [[1, 1], [2, 3], [3, 3], [4, 2], [5, 1.5], [6, .5]], fh: 3.3, roof: 0.6, ruin: 0.02 },

  // ---------------- Stazione, Oreto, Brancaccio, Corso dei Mille ----------------
  stazione: { plaster: ['#cfc3ab', '#c4b59b', '#d2c7b0', '#bdae96', '#c9b79e', '#d6cab4', '#c9b08a', '#d0b9a2'], stone: ['#b5a68a', '#a89a80'], pStone: 0.08, grime: 0.55, elig: true,
    w: { n19: .34, pw: .24, blk: .2, res: .12, bar: .06, ind: .04 }, fl: [[4, 2], [5, 3], [6, 3], [7, 1.5]], fh: 3.6, roof: 0.15 },
  oreto: { plaster: ['#cbb890', '#c8aa84', '#d0bc98', '#bfb29a', '#d4b890', '#c4a888', '#d8c8a8', '#b8aa94'], stone: ['#a98f68'], pStone: 0.12, grime: 0.62, elig: true,
    w: { res: .42, pw: .24, blk: .16, n19: .08, ind: .06, pal: .04 }, fl: [[2, 2], [3, 3], [4, 3], [5, 2], [6, 1]], fh: 3.3, roof: 0.4 },
  brancaccio: { plaster: ['#d4c4a0', '#cdb894', '#dccdaa', '#c4b49a', '#d8b894', '#c8c0aa', '#e0d4b8', '#bfa88a'], stone: ['#a98f68'], pStone: 0.05, grime: 0.55, elig: true,
    w: { res: .46, pw: .2, blk: .14, pal: .12, ind: .05, fish: .03 }, fl: [[2, 2], [3, 3], [4, 3], [5, 2], [6, .7]], fh: 3.2, roof: 0.5 },
  corsoMille: { plaster: ['#cfc0a0', '#c8b894', '#d4c4a4', '#bfb09a', '#d6b890', '#c8c0aa', '#d8c8a8', '#c0a88a'], stone: ['#a98f68'], pStone: 0.05, grime: 0.62, elig: true,
    w: { res: .36, pw: .3, blk: .16, ind: .1, pal: .08 }, fl: [[2, 1], [3, 3], [4, 3], [5, 2], [6, 1]], fh: 3.3, roof: 0.35 },

  // ---------------- ZEN, CEP, Borgo Nuovo: large public housing ----------------
  // ZEN (San Filippo Neri): prefab concrete slab insulae, exterior stairwells, faded paint, heavy grime, flat roofs.
  zen: { plaster: ['#c9c6bc', '#bfbcb0', '#d0c8b4', '#cbb9a0', '#b8b5aa', '#d6cbb0', '#c6a898', '#aeb0a8'], stone: ['#b8b5aa'], pStone: 0, grime: 0.8, elig: true,
    w: { ins: .72, pw: .08, res: .14, pal: .06 }, fl: [[3, 1], [4, 2], [5, 3], [6, 3], [7, 2]], fh: 3.0, roof: 0 },
  cep: { plaster: ['#d6c8a8', '#cbbfa6', '#d2b890', '#c8c4b4', '#bfb4a0', '#d8cdb4', '#c8a888', '#d0d0c4'], stone: ['#b8b0a0'], pStone: 0, grime: 0.65, elig: true,
    w: { ins: .3, blk: .24, pw: .22, pal: .16, res: .08 }, fl: [[3, 2], [4, 3], [5, 3], [6, 2], [7, 1]], fh: 3.1, roof: 0.05 },

  // ---------------- north: Tommaso Natale, Sferracavallo, Mondello, Valdesi ----------------
  tn: { plaster: ['#e6dcc0', '#e0d0b0', '#d8c8a8', '#ece6d6', '#d6c0a0', '#e0c0a0', '#cfc8b4', '#dcc9a0'], stone: ['#bba07a'], pStone: 0.02, grime: 0.35, elig: true,
    w: { pal: .34, res: .34, fish: .16, blk: .08, pw: .08 }, fl: [[1, 1], [2, 3], [3, 3], [4, 2], [5, .7]], fh: 3.1, roof: 0.9 },
  // Sferracavallo: low whitewashed and pastel fishermen's houses around the harbour, flat roofs with a parapet, painted wooden doors.
  sferra: { plaster: ['#ece6d8', '#e6dcc4', '#dcc9a0', '#d6cfc0', '#e8d6b4', '#c8d2d0', '#e0c0a8', '#f0ebe0', '#d8e0d8'], stone: ['#bba07a'], pStone: 0, grime: 0.4, elig: true,
    w: { fish: .66, res: .22, pal: .12 }, fl: [[1, 2], [2, 4], [3, 2], [4, .4]], fh: 3.0, roof: 0.35,
    gl: [['fis_door', 3], ['fis_win', 3], ['g_garage', 1], ['blank_g', 1]] },
  // Mondello village: Liberty villas, summer houses with deep eaves, pastel and cream plaster, blue trim.
  mondello: { plaster: ['#e6d8a8', '#e4cdb4', '#d9c096', '#eadfc6', '#e8e0c8', '#d8b8a0', '#f0ebe0', '#d4cba8'], stone: ['#bba07a'], pStone: 0.03, grime: 0.22, elig: true,
    w: { lib: .3, res: .26, fish: .2, pal: .2, n19: .04 }, fl: [[1, 1], [2, 4], [3, 3], [4, 1.5]], fh: 3.1, roof: 1.5,
    gl: [['fis_door', 2], ['fis_win', 2], ['g_win', 2], ['g_garage', 1]] },
  // The Mondello beach front: cabins, clubs on stilts, summer kiosks.
  lido: { plaster: ['#f0ede4', '#ece8dc', '#f4f2ea', '#e0eae8'], stone: ['#bba07a'], pStone: 0, grime: 0.15, elig: true,
    w: { fish: .3, lib: .2, res: .5 }, fl: [[1, 4], [2, 2]], fh: 3.0, roof: 0.4, beach: true,
    gl: [['bch_a', 3], ['bch_b', 2], ['g_win', 1]] },
  valdesi: { plaster: ['#e6dcc0', '#ece0c0', '#e4cdb4', '#eae4d4', '#d8c8a8', '#e0e0c8', '#d9c096', '#e8d6b4'], stone: ['#bba07a'], pStone: 0.04, grime: 0.22, elig: true,
    w: { lib: .38, res: .26, pal: .2, fish: .1, n19: .06 }, fl: [[1, 1], [2, 3], [3, 3], [4, 1.5]], fh: 3.2, roof: 1.4,
    gl: [['g_win', 2], ['g_door2', 2], ['g_garage', 1], ['fis_door', 1]] },

  // ---------------- Arenella, Acquasanta, Vergine Maria ----------------
  acquasanta: { plaster: ['#d8c8a4', '#d0bc98', '#dccdaa', '#c9b08a', '#e0d4b8', '#c8a888', '#d6c0a0', '#ece6d6'], stone: ['#a98f68'], pStone: 0.1, grime: 0.5, elig: true,
    w: { res: .4, fish: .24, pw: .14, lib: .1, n19: .08, pal: .04 }, fl: [[1, 1], [2, 3], [3, 3], [4, 2], [5, 1]], fh: 3.2, roof: 0.9 },
  arenella: { plaster: ['#ece6d8', '#e6dcc4', '#dcc9a0', '#d6cfc0', '#e0c0a8', '#c8d2d0', '#d8c8a4', '#f0ebe0'], stone: ['#a98f68'], pStone: 0.04, grime: 0.5, elig: true,
    w: { fish: .5, res: .3, pw: .08, pal: .12 }, fl: [[1, 2], [2, 4], [3, 3], [4, 1]], fh: 3.0, roof: 0.6,
    gl: [['fis_door', 3], ['fis_win', 3], ['g_garage', 1], ['blank_g', 1]] },

  // ---------------- port and industry ----------------
  porto: { plaster: ['#c4c6c2', '#b8bab4', '#d0cdc2', '#a9aca8', '#c9c2b0', '#d4ccb4', '#bdb8aa'], stone: ['#a9aca8'], pStone: 0, grime: 0.72, elig: true,
    w: { ind: .56, pw: .2, n19: .1, blk: .06, res: .08 }, fl: [[1, 2], [2, 3], [3, 1.5], [4, 1], [5, 1], [6, .5]], fh: 4.2, roof: 0.1, shed: true },
  brin: { plaster: ['#c4c6c2', '#b8bab4', '#d0cdc2', '#a9aca8', '#c9c2b0', '#d4ccb4', '#bdb8aa'], stone: ['#a9aca8'], pStone: 0, grime: 0.7, elig: true,
    w: { ind: .74, res: .1, pw: .08, blk: .08 }, fl: [[1, 3], [2, 3], [3, 1]], fh: 4.6, roof: 0.1, shed: true },

  // ---------------- west and north-west: Uditore, Passo di Rigano, outskirts ----------------
  uditore: { plaster: ['#e6dcc0', '#e0d0b0', '#e8e2d2', '#d8c8a8', '#ece6d6', '#d9b890', '#cfc8b4', '#e0c8a8'], stone: ['#bba07a'], pStone: 0.02, grime: 0.28, elig: true,
    w: { pal: .36, blk: .2, res: .16, pw: .14, fish: .1, n19: .04 }, fl: [[2, 1], [3, 3], [4, 3], [5, 3], [6, 1.5]], fh: 3.1, roof: 0.5 },
  rigano: { plaster: ['#e0d4b4', '#d8c8a8', '#e4dcc8', '#d2bda0', '#e8e2d2', '#d9b890', '#cdc6b2', '#dcc9a0'], stone: ['#bba07a'], pStone: 0.03, grime: 0.35, elig: true,
    w: { pal: .34, res: .26, blk: .12, pw: .14, fish: .1, n19: .04 }, fl: [[2, 2], [3, 3], [4, 3], [5, 2], [6, 1]], fh: 3.1, roof: 0.8 },
  periph: { plaster: ['#e0d4b4', '#d8c8a8', '#e4dcc8', '#d2bda0', '#e8e2d2', '#d9b890', '#cdc6b2', '#dcc9a0', '#cfa888'], stone: ['#bba07a'], pStone: 0.03, grime: 0.4, elig: true,
    w: { pal: .3, res: .3, pw: .16, blk: .1, fish: .1, n19: .04 }, fl: [[2, 2], [3, 3], [4, 3], [5, 2], [6, 1]], fh: 3.2, roof: 0.7 },
  rural: { plaster: ['#e0d4b4', '#d8c8a8', '#e8e2d2', '#d2bda0', '#ece6d6', '#cdc6b2'], stone: ['#bba07a'], pStone: 0.1, grime: 0.4, elig: true,
    w: { res: .5, fish: .5 }, fl: [[1, 3], [2, 3], [3, 1]], fh: 3.0, roof: 1.2 },
  // La Favorita: country villas of the Bourbon park, ochre and pink plaster, red tile roofs.
  favorita: { plaster: ['#d8b88a', '#d6a890', '#e0cfa8', '#c9a070', '#dcc9a0', '#d0b08a', '#e4d6b4', '#c8a07a'], stone: ['#b09870'], pStone: 0.12, grime: 0.35, elig: true,
    w: { lib: .22, res: .46, n19: .16, bar: .06, fish: .1 }, fl: [[1, 2], [2, 4], [3, 2]], fh: 3.8, roof: 1.6 },
};

// Seeds: [zone, lat, lon, reach in metres]. A building takes the zone whose seed is nearest in units of reach (a weighted
// Voronoi). Reach is the radius at which a seed stops claiming land: tight in the dense centro, wide in the outskirts.
const SEEDS_LL = [
  // centro storico (the original calibration seeds; 330 m reach as before)
  ['old', 38.1170, 13.3550, 330], ['old', 38.1188, 13.3648, 330], ['old', 38.1190, 13.3687, 330],
  ['alberg', 38.1105, 13.3577, 330], ['alberg', 38.1092, 13.3545, 260], ['alberg', 38.1120, 13.3600, 200],
  ['kalsa', 38.1150, 13.3690, 330], ['kalsa', 38.1137, 13.3705, 330], ['kalsa', 38.1160, 13.3722, 240], ['kalsa', 38.1120, 13.3730, 240],
  ['politeama', 38.1265, 13.3545, 330], ['politeama', 38.1235, 13.3575, 330], ['roma', 38.1090, 13.3650, 330], ['roma', 38.1125, 13.3635, 330],
  ['corso', 38.1157, 13.3613, 330], ['corso', 38.1195, 13.3572, 330], ['corso', 38.1148, 13.3562, 330], ['corso', 38.1160, 13.3650, 330],
  // Libertà belt, sacco di Palermo
  ['viaLib', 38.1292, 13.3512, 420], ['viaLib', 38.1330, 13.3503, 420], ['viaLib', 38.1370, 13.3485, 420], ['viaLib', 38.1412, 13.3445, 420],
  ['sacco', 38.1340, 13.3440, 600], ['sacco', 38.1385, 13.3377, 600], ['sacco', 38.1360, 13.3560, 400], ['sacco', 38.1435, 13.3395, 500],
  ['sacco', 38.1500, 13.3290, 500], ['sacco', 38.1560, 13.3260, 500], ['sacco', 38.1470, 13.3345, 400],
  ['resut', 38.1530, 13.3220, 700], ['resut', 38.1600, 13.3250, 600], ['resut', 38.1490, 13.3170, 600],
  ['fiera', 38.1396, 13.3519, 450], ['fiera', 38.1445, 13.3490, 450],
  // Borgo Vecchio, Noce, Zisa, Cuba
  ['borgoV', 38.1283, 13.3586, 420], ['borgoV', 38.1262, 13.3612, 300], ['borgoV', 38.1300, 13.3560, 300],
  ['noce', 38.1220, 13.3332, 500], ['noce', 38.1204, 13.3378, 400], ['noce', 38.1260, 13.3400, 400], ['noce', 38.1190, 13.3430, 300],
  ['zisa', 38.1162, 13.3412, 420], ['zisa', 38.1120, 13.3410, 400], ['zisa', 38.1064, 13.3408, 500], ['zisa', 38.1150, 13.3480, 300],
  // Stazione, Oreto, Brancaccio, Corso dei Mille
  ['stazione', 38.1103, 13.3669, 450], ['stazione', 38.1070, 13.3640, 350],
  ['oreto', 38.1020, 13.3715, 500], ['oreto', 38.0985, 13.3700, 500], ['oreto', 38.1040, 13.3600, 400],
  ['brancaccio', 38.0980, 13.3810, 600], ['brancaccio', 38.0930, 13.3830, 600], ['brancaccio', 38.0960, 13.3900, 500],
  ['corsoMille', 38.1017, 13.3860, 500], ['corsoMille', 38.0880, 13.3990, 600], ['corsoMille', 38.0990, 13.3930, 400],
  ['brin', 38.1030, 13.3785, 450], ['brin', 38.0976, 13.3784, 350],
  // the port and the shipyards
  ['porto', 38.1245, 13.3705, 500], ['porto', 38.1300, 13.3680, 400], ['porto', 38.1354, 13.3630, 400],
  // ZEN, CEP, Borgo Nuovo
  ['zen', 38.1786, 13.3127, 600], ['zen', 38.1834, 13.3149, 600], ['zen', 38.1816, 13.3176, 450], ['zen', 38.1770, 13.3180, 400],
  ['cep', 38.1300, 13.2983, 700], ['cep', 38.1428, 13.3217, 500], ['cep', 38.1103, 13.3265, 500],
  // north
  ['tn', 38.1895, 13.2985, 800], ['tn', 38.1806, 13.2966, 700], ['tn', 38.1950, 13.3050, 600],
  ['sferra', 38.1990, 13.2830, 450], ['sferra', 38.2083, 13.2836, 450], ['sferra', 38.1930, 13.2831, 400],
  ['mondello', 38.2054, 13.3235, 450], ['mondello', 38.2010, 13.3262, 500], ['mondello', 38.2125, 13.3251, 450],
  ['lido', 38.2090, 13.3262, 220], ['lido', 38.2075, 13.3285, 200],
  ['valdesi', 38.1969, 13.3318, 500], ['valdesi', 38.1930, 13.3350, 500],
  // coast north-east: Arenella, Acquasanta, Vergine Maria
  ['acquasanta', 38.1437, 13.3672, 500], ['acquasanta', 38.1454, 13.3702, 350], ['arenella', 38.1515, 13.3730, 450], ['arenella', 38.1576, 13.3710, 450],
  // west
  ['uditore', 38.1317, 13.3227, 600], ['uditore', 38.1334, 13.3177, 500], ['rigano', 38.1262, 13.3115, 600], ['rigano', 38.1200, 13.3160, 500],
  ['periph', 38.1014, 13.3264, 900], ['periph', 38.1097, 13.3239, 800], ['periph', 38.1103, 13.3040, 900], ['periph', 38.1190, 13.3280, 600],
  ['periph', 38.1450, 13.3100, 900], ['periph', 38.1100, 13.3400, 500],
  // the park
  ['favorita', 38.1620, 13.3378, 700], ['favorita', 38.1700, 13.3330, 700], ['favorita', 38.1590, 13.3430, 500], ['favorita', 38.1760, 13.3360, 700],
  // far corners and the countryside
  ['rural', 38.0750, 13.3050, 3000], ['rural', 38.0750, 13.4050, 3000], ['rural', 38.2200, 13.3900, 3000], ['rural', 38.2200, 13.2900, 3000], ['rural', 38.1700, 13.2800, 1500],
];
export const SEEDS = SEEDS_LL.map(([z, la, lo, reach]) => { const p = proj(la, lo); return [z, p[0], p[1], reach]; });

// Streets that define a zone by themselves (matched against the nearest street's name, within `d` metres of its edge).
const STREET_ZONES = [
  [/^Via della Libertà$|^Viale della Libertà$/, 'viaLib', 24],
  [/Strasburgo|^Via Notarbartolo|^Via Principe di Paternò|^Viale del Fante|^Viale Francia|^Via Duca della Verdura|^Via Sciuti/, 'sacco', 16],
  [/^Corso dei Mille$/, 'corsoMille', 22],
  [/^Via Oreto$/, 'oreto', 18],
];

// zone for a building centroid (x, z in metres) given its nearest street name `n` and distance `d` (metres, from the carriageway edge)
export function zoneAt(cx, cz, n, d) {
  n = n || '';
  if (/^Via Roma$/.test(n)) return 'roma';
  if (/Maqueda|Vittorio Emanuele|Cassaro|Bologni|Pretoria|Verdi|Quattro Canti|San Domenico/.test(n)) return 'corso';
  for (const [re, z, dm] of STREET_ZONES) if (re.test(n) && d < dm) return z;
  let best = null, bd = 1;
  for (let i = 0; i < SEEDS.length; i++) {
    const s = SEEDS[i], q = Math.hypot(cx - s[1], cz - s[2]) / s[3];
    if (q < bd) { bd = q; best = s[0]; }
  }
  if (best) return best;
  // nothing claims it: the old city around Quattro Canti, otherwise the generic outskirts
  return Math.hypot(cx, cz) < 1500 ? 'centro' : 'periph';
}

// deterministic hash in [0, 1) from two numbers
const hash = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
const pickW = (list, u) => { let t = 0; for (const e of list) t += e[1]; t *= u; for (const e of list) { t -= e[1]; if (t <= 0) return e[0]; } return list[list.length - 1][0]; };

// Storeys for a building whose baked height is only the generic estimate (3 to 6 floors, no lidar, no OSM levels).
export function floorsAt(Z, cx, cz, area) {
  if (!Z.fl) return 0;
  let n = pickW(Z.fl, hash(cx * 0.37 + 7.1, cz * 0.61 + 3.3));
  if (area < 70) n = Math.min(n, 3); else if (area < 130) n = Math.min(n, 5); else if (area < 220) n = Math.min(n, 8);
  return n;
}

// Replace the generic baked heights of a tile in place by district-typical ones, once per tile. Measured (lidar) heights, OSM building:levels,
// named, church, historic and special buildings are left alone. Call it as soon as a tile is parsed so the low-detail extrusions agree.
const DONE = new WeakSet();
export function applyDistrictHeights(data, zoneFor) {
  if (!data || !data.buildings || DONE.has(data)) return;
  DONE.add(data);
  for (const b of data.buildings) {
    if (b.r !== undefined || b.lv || b.t || b.k || b.hi || b.n || b.am || b.dh) continue;
    const pat = (b.h - 1) / 3.4;
    if (Math.abs(pat - Math.round(pat)) > 0.06 || pat < 2.9 || pat > 6.1) continue; // not the generic 3..6 floor estimate: keep
    const p = b.p; let cx = 0, cz = 0, a = 0, n = p.length / 2;
    for (let i = 0; i < p.length; i += 2) { cx += p[i]; cz += p[i + 1]; const j = (i + 2) % p.length; a += p[i] * p[j + 1] - p[j] * p[i + 1]; }
    cx /= n; cz /= n; a = Math.abs(a) / 2;
    if (a < 40) continue;
    const Z = ZONES[zoneFor ? zoneFor(cx, cz) : zoneAt(cx, cz, '', 1e9)];
    if (!Z || !Z.fl) continue;
    const f = floorsAt(Z, cx, cz, a), fh = Z.fh || 3.2;
    b.h = Math.round((fh + 0.8 + (f - 1) * fh + 0.9) * 10) / 10; b.dh = f; // ground floor taller, plus parapet
  }
}
