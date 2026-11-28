// Named stretches of the map's walls and fences whose real look is known from photos. The map gives a line and a guessed height (tools/fences.py), and src/fence-walls.js finishes the
// ones beside a street by chance, so some monument fronts stood behind a blank wall where there is an open railing, a low wall with a railing or a balustrade. This list changes only
// what is drawn along those lines: every piece keeps the line, the height, the kind and the flag that decide how it collides and breaks. Nothing else in the city is touched.
// src/fences.js draws a piece with a `look`:
//   h     height of the masonry above the ground (m); bare: no masonry at all (an open fence or a gate)
//   th    its thickness; ly the texture layer (src/wall-paint.js); col its colour
//   rail  a panel on top of the masonry (or on the ground): s the style (0 dark railing, 2 grey lattice), h its height
//   balus a stone balustrade on the masonry: h its height (balusters under a coping)
//   pier  stone pillars: every n pieces and at both ends of the stretch; h above the ground, w the side
//   shrub low planting over the edging: share of the pieces that carry a bush
//
// Photos (looked at, nothing copied or stored):
//   La Martorana terrace: Wikimedia Commons "Chiesa della Martorana - Palermo, Italia - 28 Aprile 2023" (golden stone retaining wall with a coping, thin iron railing on it, a gated
//     stair west of the church front), "Churches of St. Cataldo and Martorana - panoramio" (railing between the bell tower and San Cataldo).
//   Cathedral garden (Piano della Cattedrale): Mapillary 819579658975988, 1106182406570296 (2015, Via Matteo Bonello: pale stone balustrade on a low base, piers, an iron gate near the
//     south corner), 4546683482106125 (2018, the Cassaro side: a taller base under the balustrade), 420098830618831 (2024, from inside).
//   Mondello beach road: Mapillary 303051834529461, 474083493819468, 805058810120522, 575286557163162, 471799387224615 (2019, north of the lido: low rubble edging with shrubs and pines
//     behind it), 349775966491036, 4246716862039196, 474346933645933 (2019, open metal fence along the beach by the Stabilimento), 515128159500600, 497641538029119, 931340367653029
//     and 1344660419249131 (2018 and 2019, south of it: kerb, verge and bushes, the beach open).
//   Maria Santissima Mediatrice: Mapillary 296248575286572, 161619925812116 (2018: low rendered wall, square pillars, metal panels on it), 508999830136843 (2017, the east side).
//   San Giuseppe, Villabate: Mapillary 160889729320719, 807518163471976 (April 2021: grey lattice railing on a low stone faced wall, gate between two pillars), 1012916579242263
//     (the same railing at the south west corner of the garden), 1199042473884603 (March 2021: iron bars on a low wall with pillars along the road east of the church).
// Not verified and left as they were: the east side of the Cathedral garden, the stair behind the Martorana gate (the game has no raised terrace, so the churches stand at street level
// and the wall is drawn lower than the real one), the Mediatrice garden's west sides, the wall between the Villabate garden and the church. The statues on the Cathedral piers are not
// drawn. Heights, the places of the gates and the spacing of the pillars are read from the photos by eye. The gate openings stay closed to the car, as the mapped line is.

const GOLD = { h: 1.25, th: 0.55, ly: 'c', col: '#ab9470', rail: { s: 0, h: 0.9 }, coping: '#c0aa82' };
const GOLD_GATE = { bare: 1, h: 0, rail: { s: 0, h: 2.1 }, pier: { every: 99, h: 2.2, w: 0.55 }, ly: 'c', col: '#ab9470' };
const BAL_BONELLO = { h: 0.7, th: 0.42, ly: 'cap', col: '#cfcabc', balus: { h: 0.78 }, pier: { every: 1, h: 1.66, w: 0.56 } };
const BAL_CASSARO = { ...BAL_BONELLO, h: 1.15, pier: { every: 1, h: 2.1, w: 0.56 } };
const BAL_GATE = { bare: 1, h: 0, rail: { s: 0, h: 2.0 }, pier: { every: 99, h: 2.0, w: 0.62 }, ly: 'cap', col: '#cfcabc' };
const EDGING = { h: 0.45, th: 0.5, ly: 'r', col: '#c4b79a', shrub: { share: 0.45 } };
const BEACH_FENCE = { bare: 1, h: 0, rail: { s: 2, h: 1.45 }, ly: 'j', col: '#8c9092' };
const MEDIATRICE = { h: 1.05, th: 0.32, ly: 'n', col: '#cdc8b6', rail: { s: 2, h: 0.85 }, pier: { every: 3, h: 1.95, w: 0.46 } };
const VILLA_GARDEN = { h: 0.7, th: 0.36, ly: 'r', col: '#bab6aa', rail: { s: 2, h: 1.05 } };
const VILLA_GATE = { bare: 1, h: 0, rail: { s: 2, h: 2.2 }, pier: { every: 99, h: 2.3, w: 0.45 }, ly: 'n', col: '#c9c4b6' };
const VILLA_ROAD = { h: 0.75, th: 0.34, ly: 'm', col: '#c2beb0', rail: { s: 0, h: 1.2 }, pier: { every: 4, h: 2.05, w: 0.42 } };

// line: the mapped line (x, z, ...), as it stands in the tile. look: for the whole line; parts: [from, to, look] in metres along it, which take over there (a gate, a change of kind).
const STRETCHES = [
  { name: 'Martorana terrace', line: [95.3, 110.8, 96, 97.4, 125.7, 99.3], look: GOLD, parts: [[35, 39, GOLD_GATE]] },
  { name: 'Martorana terrace, east', line: [140, 97.8, 148.5, 95.9], look: GOLD },
  { name: 'Cathedral garden, Via Bonello', line: [-486.3, 203.2, -474.1, 224.1, -460.7, 240.7], look: BAL_BONELLO, parts: [[37.5, 41, BAL_GATE]] },
  { name: 'Cathedral garden, south corner', line: [-460.7, 240.7, -447.8, 234.6], look: BAL_CASSARO },
  { name: 'Cathedral garden, Cassaro 1', line: [-440.8, 231.1, -420.7, 221.2], look: BAL_CASSARO },
  { name: 'Cathedral garden, Cassaro 2', line: [-414.3, 218.3, -395.3, 208.4], look: BAL_CASSARO },
  { name: 'Cathedral garden, Cassaro 3', line: [-389.3, 205.3, -372.4, 197.3], look: BAL_CASSARO },
  { name: 'Mondello, garden strip', line: [-3148, -9972.8, -3151.3, -9954.7, -3153.1, -9941, -3154.3, -9922.6, -3154.5, -9906.9, -3153.7, -9890.8, -3142.1, -9791.7, -3138.7, -9774.2, -3131.7, -9751.3, -3129.6, -9745.8, -3110.1, -9704.5], look: EDGING },
  { name: 'Mondello, lido north', line: [-3107.1, -9700.2, -3091.6, -9666.1, -3085.5, -9668.5, -3065.8, -9630.5], look: BEACH_FENCE, parts: [[0, 37.5, EDGING]] },
  { name: 'Mondello, by the gate', line: [-3062.6, -9622.4, -3041.3, -9580.7], look: BEACH_FENCE },
  { name: 'Mondello, lido south', line: [-3038.9, -9576.3, -3002.3, -9504.8], look: BEACH_FENCE },
  { name: 'Mondello, lido end', line: [-2999.9, -9500, -2994, -9488.6], look: BEACH_FENCE },
  { name: 'Mondello, south verge 1', line: [-2992.9, -9475.8, -2960.5, -9411.8], look: EDGING },
  { name: 'Mondello, south verge 2', line: [-2957, -9406.9, -2954.4, -9400.6, -2936.8, -9373.8, -2920.4, -9351.6, -2854.6, -9276.9], look: EDGING },
  { name: 'Mondello, south verge 3', line: [-2847.9, -9270.2, -2825.6, -9245.6], look: EDGING },
  { name: 'Mediatrice, east', line: [-2369.4, 1500, -2353.2, 1564.2], look: MEDIATRICE },
  { name: 'Mediatrice, front', line: [-2353, 1564.8, -2346.6, 1590.2, -2397.4, 1614.4], look: MEDIATRICE },
  { name: 'Villabate garden, north', line: [7675.9, 4246.9, 7629.2, 4228.9], look: VILLA_GARDEN, parts: [[20.5, 23.5, VILLA_GATE]] },
  { name: 'Villabate garden, west', line: [7648.6, 4236.4, 7623.2, 4279], look: VILLA_GARDEN },
  { name: 'Villabate, road east of the church', line: [7781.9, 4287.8, 7679.2, 4248.2], look: VILLA_ROAD },
];

const TOL = 0.8;   // a piece belongs to a line when both its ends are this close to it (so a wall that only meets the line does not)
for (const s of STRETCHES) {
  const xs = s.line.filter((v, i) => !(i % 2)), zs = s.line.filter((v, i) => i % 2);
  s.box = [Math.min(...xs) - TOL, Math.min(...zs) - TOL, Math.max(...xs) + TOL, Math.max(...zs) + TOL];
}
// [distance from the line, metres along it]
function onLine(line, x, z) {
  let best = 1e9, at = 0, run = 0;
  for (let i = 0; i + 3 < line.length; i += 2) {
    const ax = line[i], az = line[i + 1], dx = line[i + 2] - ax, dz = line[i + 3] - az, l = Math.hypot(dx, dz), t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (l * l || 1)));
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) { best = d; at = run + l * t; }
    run += l;
  }
  return [best, at];
}
function lookOf(near, a, b) {
  for (const s of near) {
    if (onLine(s.line, a[0], a[1])[0] > TOL || onLine(s.line, b[0], b[1])[0] > TOL) continue;
    const at = onLine(s.line, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2)[1], part = s.parts?.find(p => at >= p[0] && at < p[1]);
    return part ? part[2] : s.look;
  }
  return null;
}

// list: the tile's walls and fences as src/fences.js is about to build them; cut(r): the points it will build record r on (its own resampling). A record on a named line is split into
// the runs that share a look, on those same points, so every piece and its collision stay where they were. A fence panel with a look becomes a wall piece that collides and breaks as a
// street fence does (the `fence` flag: the same speed, the same push back). Records away from the named lines come back untouched.
export function dressWalls(list, cut) {
  return list.flatMap(r => {
    if (r.k === 'g' || !r.p || r.p.length < 4) return [r];
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (let i = 0; i < r.p.length; i += 2) { x0 = Math.min(x0, r.p[i]); x1 = Math.max(x1, r.p[i]); z0 = Math.min(z0, r.p[i + 1]); z1 = Math.max(z1, r.p[i + 1]); }
    const near = STRETCHES.filter(s => x1 >= s.box[0] && x0 <= s.box[2] && z1 >= s.box[1] && z0 <= s.box[3]);
    if (!near.length) return [r];
    const pts = cut(r), looks = [];
    for (let i = 0; i + 1 < pts.length; i++) looks.push(lookOf(near, pts[i], pts[i + 1]));
    if (!looks.some(Boolean)) return [r];
    const out = [];
    for (let i = 0; i < looks.length;) {
      let j = i; while (j + 1 < looks.length && looks[j + 1] === looks[i]) j++;
      const p = pts.slice(i, j + 2).flat(), look = looks[i];
      if (!look) out.push({ ...r, p });
      else out.push({ ...r, ...(r.k === 'f' ? { k: 'w', fence: 1 } : {}), p, look });
      i = j + 1;
    }
    return out;
  });
}
