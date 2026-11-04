# Expressways and road paint (round 3 items 4 and 5)

Photos: po25, zi15 to zi18, su09, su10, lm19 to lm23, mo25 (round 3). What they show on Palermo's fast roads: steel W-beam guard rails on both sides (often two beams), a rail in the median where two carriageways run side by side,
solid white edge lines, green gantry signs, scrub verges. The game had ordinary streets.

## What is built (src/expressway.js, src/direction-signs.js, src/fences.js)

- **Which roads.** `motorway`, `trunk`, their `_link` roads, and the one-way `primary` carriageways with OSM `maxspeed` 70 or more (Viale Regione Siciliana, 17.5 km per direction; the Palermo-Sciacca road is two-way and
  gets rails on both edges). Bridges and tunnels are left out. The city has no `trunk` way in the bake. Slip roads of the Viale (`primary_link`) count when one end touches such a carriageway.
- **Where the rail stands.** The edge is where the tile's asphalt raster (the one `src/roadwear.js` uses) ends, probed outwards from the mapped half width; the rail is 0.9 m beyond it (1.0 m for the double beam). Where the asphalt
  does not end within 6.5 m of the mapped width (a service lane or a wide survey polygon), the rail goes 3.3 m from the mapped edge. A rail piece is dropped where another drivable road is within its half width and
  1.2 m (junctions, slip roads, service roads, side streets, exits), within 14 m of a bridge or tunnel of the same road, or within 3 m of an OSM guard rail or concrete barrier (those stay as they are). Runs under 7.5 m are dropped.
- **Median.** Two opposite one-way ways of the same name and class with under 6 m between their edges get one rail in the middle, built by the lower way id; otherwise each carriageway has its own edge rails.
- **Geometry and collision.** Rails are `g` fences: 2.5 m panels in one instanced mesh per style per tile (a new `wbeam` and `wbeam2` style: 6 triangles a panel, one post at its start), walls in the wall grid, so cars, traffic and pedestrians stop at
  them. Breaking: every `g` fence (also the 71 OSM ones, which broke at 2.6 m/s) now breaks at 15 m/s effective speed, the speed into the rail plus 0.55 of the speed along it: a scrape or a bump holds, a head-on hit at about 55 km/h goes through.
  A broken panel flies off and the gap stays, like the other fences. At most 2,400 rail panels a tile.
- **Fences beside a fast road** (CTR plot lines within 12 m, `src/fence-walls.js`) stay fences and take the wire mesh style; they are no longer re-read as plastered walls.
- **Signs** (`tools/expressway_signs.py` reads the OSM `destination`, `destination:ref`, `destination:lanes` tags of the motorway and slip road ways into `src/expressway-signs.js`): 24 roadside exit boards at slip roads and 8 overhead
  gantries over carriageways with `destination:lanes` or `destination`, a green panel per run of lanes with the same text (place names and refs as OSM has them; nothing invented). The A29 ways with lane tags are only 2-node stubs, so their
  gantries do not exist. One merged mesh per tile, one shared material (a text atlas), the posts are wall segments.
- **The Viale's carriageways the data calls streets** (`src/road-class.js`): the one-way `primary` (maxspeed 30 or 50 in places) ways named Viale Regione Siciliana, Circonvallazione or Raccordo are fast roads whatever their class
  says (5.2 km), all the way. Its one-way side lanes (`tertiary` or `secondary`, width 7 m or more, 26.9 km) are fast roads only where nothing is built beside them: `tools/fast-built.mjs` measures each lane along its whole length
  (a building outline within the half width + 14 m on either side makes a 5 m sample built; a lone built bit under 40 m is dropped, built stretches grow 15 m, an open gap or end under 100 m becomes built) and bakes the built
  stretches into `src/fast-built.js` (a point every 10 m; run it again after a rebake). Open: 12.5 km (north-west 9.3, south-east 3.2); built: 14.4 km (10.1 and 4.3), which stay city streets. Where a lane is fast it gets the rails
  (a single beam; one rail in the middle where it runs beside a carriageway with under 6 m between the mapped edges), edge lines and lane dashes, no zebra crossings (paint, props and the pedestrians' strips), no parked cars or bins,
  no double-parking scenes, a tall double-arm pole every 40 m on the right of travel where no mapped lamp is within 24 m, and the roadside walls within 6 m of it become rails (src/fence-walls.js); a pavement beside it is the
  rough shoulder, not slabs (src/streets.js isYard). In the built stretches the lane keeps what a city street has. Two-way streets of the same names and the residential lanes are city streets everywhere.
- `?noexpressway` turns the rail rule and the new paint off, `?nosigns` the signs.

## Road paint (src/streets.js `roadMarksIter`)

- Dashes follow the measured Palermo pattern: a 2.2 m dash every 5.9 m (it was 3 m every 9 m). Lanes divide the carriageway evenly between the edge lines.
- The dashed centre line of a two-way road turns solid for the last 15 m before a junction (the approach line); the junction itself stays clear.
- A stop line (a 0.4 m bar across the lanes that come toward the node, the right half on a two-way road) 6.5 m before each of the 312 traffic signals of the props, on every road that meets the node.
- Edge lines on more classes: secondary roads, their links, and tertiary or unclassified roads that OSM gives a limit of 50 or more (they had motorway, trunk, primary).
- On the fast roads the edge lines stand 1.3 m inside the edge of the real asphalt (the tile raster) instead of the mapped half width, and lanes divide what is between them, so a carriageway the bake calls two lanes but the survey draws wider is painted over its width.
- Gore hatching: where a slip road leaves or joins a fast road, diagonal bars across the wedge between the two carriageways (up to 22 bars, while the gap is 0.9 to 6.5 m).
- Paint triangles over the whole city: 383 thousand before, 511 thousand now (342 and 455 a tile on average, 2,328 in the worst tile). Build time 0.8 ms a tile on average, 13 ms at most.
- `?noexpressway` keeps the old width logic on fast roads (the other changes stay).

## Numbers

Rails over the whole city: 96 km in 84 tiles, 38,461 panels (231 thousand triangles if every tile were loaded), at most 1,519 panels (9 thousand triangles) in one tile, 19 ms of build time a tile on average (72 ms at most, raster included),
one or two extra draw calls a tile that has rails and one for a tile that has signs. Whole-frame triangle counts at the round 3 viewpoints move by more than this between two runs of the same build (traffic and pedestrians), so the cost is
counted per tile here and not per frame. Phone profile (844 x 390, 4x CPU, three alternating runs, a loaded machine, so about 3 ms of noise): su18 15.5 ms before and 13.1 after, Viale Regione 16.2 before and 18.0 after,
A29 Raccordo 20.3 before and 17.2 after: no change that the noise does not cover.

## What the data does not have

- OSM guard rails: 71 ways (1.9 km) in the whole city, so the rule does the work.
- `cycleway:both` and `cycleway:right` are on 676 and 586 ways but 822 and 584 of them say `no`: the real lanes are 4 `lane`, 27 `shared_lane`, a handful of `track` and `separate`. Bus lanes (`busway`, `lanes:psv`, `bus:lanes`): about 20 ways, none of them in the tiles
  (the bake keeps `pk` only). Parking lanes: 28 ways. These need `cy` and `bl` fields in `tools/tiles.py` and a rebake; for 50 ways that is not worth a release by itself.
- Stop signs (`highway=stop`): not in `tools/props.py`. Traffic signals are (312, `signal` in the props), and they get stop lines.
- Hatched areas beside the tram (Via Pecori Giraldi, Viale Di Vittorio): no polygon in the bake or in the OSM caches (16 ways carry `area:highway`, none says hatching). Not painted.
