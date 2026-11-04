# Faithfulness survey, zone SOUTH and SOUTH-EAST: the game against Mapillary photos

Date: 4 November 2026. Game commit shot: c96e15d (a `git archive` snapshot of HEAD served on its own port). One reviewer, one pass, no game changes. Nothing here is copied from a photo; the photos were looked at and live outside the repo.

Zone: Villaggio Santa Rosalia, Falsomiele, Chiavelli, Guadagna, Ciaculli, Brancaccio, Settecannoli, Romagnolo, Roccella, Bandita, Acqua dei Corsari, Pomara, Villabate, Belmonte Mezzagno, with the roads and fields between them. Croce Verde Giardina could not be placed (a place search found nothing), so it has no anchor and no viewpoint. In game metres the box is x -2400 to 8210 and z 1500 to 7817 (the last is the south edge of the baked map). District names below are the nearest of 14 anchor points taken from OpenStreetMap suburb and neighbourhood nodes, not a boundary file: the median viewpoint is 663 m from its anchor and 18 of the 45 are more than 800 m away, so read the names as "somewhere around".

## What was compared

- **45 viewpoints, 45 photo pairs, all shot and all looked at.** Game camera at the photo's own position and heading, 1.6 m up, 60 degrees vertical fov, 11:00, UI and car hidden, 1024 by 768, 4.5 s of settle after the world reported itself calm. 45 of 45 shot on the first pass, none flagged "not settled", no page errors. I read 8 contact sheets (6 pairs each, 384 by 288 per picture) and a few full-size shots (zs06, zs15). Small detail (a sign, a fence type) is weak evidence at that size and I say so where it matters.
- **How the viewpoints were chosen.** I did not pick road points blind, because the west survey found only 23 of 69 blind points had a photo within 35 m and none of the edge-of-town points did. I asked the Mapillary Graph API for every non-panoramic image in the box (300 cells of 0.005 degrees, none failed, none hit the 2000 limit): **39,732 images**. 29,560 of them lie within 7 m of a drivable road centreline in `world/tiles/*.json` and look along it (within 30 degrees). By class of that road: 22,335 main, 6,812 residential, 219 edge of town, 111 country track, 83 centre. So Mapillary here is 76 % main roads, and the classes that matter for the outskirts have a few hundred photos each at most.
- **Classes.** main = motorway, primary, secondary, tertiary and their links. Residential = residential, living-street, unclassified and service roads with at least 25 buildings in the 300 m square around the photo. Edge of town = the same road kinds with fewer than 25. Country = OSM `track`. Centre = a pedestrian way, or within 60 m of an OSM plaza polygon (19 in the box).
- **Sampling.** Farthest-point sampling per class with at least 250 m between picks, newest photo first within each 100 m ring: centre 4, country 3, edge 12, residential 12, main 8 (39). Then one more viewpoint for each district that had none within 500 m (Falsomiele, Ciaculli, Romagnolo, Acqua dei Corsari), then two more main-road points (Falsomiele, Chiavelli). Candidates more than 1500 m from every anchor were dropped (1,189 of 29,560). Result by class: **14 residential, 12 main, 12 edge of town, 4 centre (zs06, zs36, zs41, zs44), 3 country track (zs04, zs23, zs39)**. By district anchor: Villabate 7, Villaggio Santa Rosalia 5, Belmonte Mezzagno 4, Chiavelli 4, Falsomiele 4, Pomara 4, Roccella 4, Acqua dei Corsari 3, Ciaculli 3, Guadagna 2, Romagnolo 2, Bandita 1, Brancaccio 1, Settecannoli 1. Brancaccio, Settecannoli, Romagnolo and Bandita are thin: the sampler spread its picks over the whole box and landed few there, and I did not force more.
- **Photo age.** Median 5.6 years, range 0.6 to 11.3. By capture month: 12 from March 2021, 9 from April 2021, 10 from March 2019, 5 from April 2026, 3 from September 2018, 2 from September 2017, 2 from July 2015, 2 from May 2021. Years of difference matter little for walls and slopes and a lot for shops, parked cars and roadworks (zs17 is a roadworks day); I did not count those as defects.
- **Photos are CC BY-SA and were never put in the repo.** The token was read from the main checkout's `data/mapillary_token` by my own scripts and sent only as a request header; it was not printed or stored, and there is no link to it in the worktree.
- Places list: `docs/faithfulness/survey/zone-south-east-places.json` (id, game x and z, road, class, Mapillary image id, heading, age). No pixels.
- **One diagnostic beyond looking.** For the tan ground question I ran a raycast through a grid of pixels on the snapshot (zs01, zs04, zs05, zs12, zs16, zs18, zs19, zs24, zs26, zs30, zs37, zs38, zs39, zs43, zs45) to see which mesh and material is under a given pixel. It changes nothing in the game. Results are marked "raycast" below.

Caveats, as in the earlier rounds. A phone compass heading is not always right, and a windscreen or dashboard shows in many photos. Mapillary positions are only as good as a phone GPS: at zs15, zs25 and zs38 the photo stands on a carriageway the game does not have where the camera stands, and I cannot tell whether the photo's position or the game's road is off. Sprites sometimes stand in front of the lens (zs06, zs30, zs37, zs38). Statuses are from one person looking at thumbnails once.

## Verdict in a few lines

The post-war blocks and the avenues are close: zs21, zs22, zs32 and zs42 (balconied blocks, shop rows, stone pines, railings, lamps) are among the best pairs, and zs12, zs14 and zs44 are good in massing. Everything between them is a different place. Beside the road the game has flat tan ground, in the foreground of 12 of 45 views, where the photos show tarmac, a pavement, a car park or thick scrub; the road edge has no poles, no wires, no guard rails and almost no lamps (20 of 45 photos show at least one of those, and the zone has zero mapped guard rails, two mapped lamps and no pole prop); the kerbs of the old residential streets are empty where the photos have cars on both sides; and walls are smooth tan plaster where the real ones are rubble, lime-wash or concrete. A drive through the south-east reads as grey ribbon on a tan plain, with a few good blocks standing on it.

## Findings per viewpoint

Layers: ground, facades, buildings missing, walls and fences, vegetation, roads and paint, terrain and mountains, props, traffic and people. "Game" is what I saw in the shot, "photo" what the Mapillary picture shows.

| id | layer | finding |
|---|---|---|
| zs01 (Acqua dei Corsari, residential, photo 2021-05) | walls and fences | A smooth tan plaster block 4 m long stands beside the lane; the photo has a villa behind an iron-mesh fence on a low wall. Tile data has four fence pieces (1.3 to 1.8 m) at 6 to 11 m. |
| zs01 | vegetation | The garden is a bright green low-poly ball (a `prop_shrub`, raycast, 4 m away) and a pink one. Photo has a palm, a pine and a hedge. |
| zs01 | roads and paint | Residential (6 m) and tertiary (8 m) ways meet within 2 m of the camera and draw one wide pale apron; the photo is a lane about 4 to 5 m wide with a triangle sign and a lamp. |
| zs02 (Via Galletti, main, 2021-04) | facades | Good: a 4-storey block with a Lotto and tabacchi shop row, hills behind. Photo's balconies and a wire across the street are missing. |
| zs02 | traffic and people | Photo has a row of cars on the right kerb and a bin. Game kerb is empty, with a very wide pale paving apron in front. |
| zs03 (Via Messina Marine, main, 2021-03) | props | Photo has a steel guard rail on the right, a pole line with wires, a rubble wall on the left and a car. Game has a flat dark hedge slab on the right and none of those. |
| zs03 | vegetation | Photo has a cane thicket and an olive tree over the road; game has a plain hedge. |
| zs04 (Bandita, track, 2021-03) | ground | A flat tan plain to the sea and a flat tan strip along the road. Raycast: the strip is the `tracks` mesh (`src/world.js` `buildTracks`, flat `#a48c66`, no texture) and the plain is terrain. Photo is asphalt with a steel guard rail, an overhanging bush, a lamp pole. |
| zs04 | props | Guard rail, lamp and sign missing. A palm crown stands in front of the building's facade. |
| zs05 (SP 38 towards Belmonte Mezzagno, main, 2019-03) | terrain and mountains | Smooth cream cut banks left and right where the photo has a grass and scrub slope and a rubble retaining wall. Sparse pines; photo has a dark pine at the edge. |
| zs05 | props | Photo has a steel guard rail on the right, a pole with wires and two signs. Game has none. Road, edge lines and traffic (a van, a car) are good. |
| zs06 (Via La Rocca, Belmonte Mezzagno centre, 2019-03) | roads and paint | The camera stands in a huge flat paved plaza with a crowd of sprites and the buildings tens of metres back. Photo is a narrow street between balconied old houses with a blue car, parked cars and planters. The tiles have 66 buildings within 100 m and a building 2 m from the camera, so the houses exist; the paving polygon is what opens the view. I did not check which OSM way or area makes it. |
| zs06 | facades | Plain beige blocks with dark slots where the photo has balconies on every floor, awnings, rendered walls in several colours. |
| zs07 (Via Salvo D'Acquisto, Belmonte Mezzagno edge, 2019-03) | buildings missing | Bare hills and a van. Photo is a street canyon with a 6-storey balconied block 10 m away. Tiles: 0 buildings within 100 m, the nearest is 129 m away, 16 within 200 m. |
| zs07 | ground | A wide pale gravel apron over the whole road width. |
| zs08 (Via Piersanti Mattarella, Belmonte Mezzagno, 2019-03) | terrain and mountains | A cream terraced bank with a low plain wall on the left and bare olive-green hills. Tiles: no building within 200 m. |
| zs08 | props | Photo has a lamp pole and a pole line on the right, a stone pine, roadside scrub and a bus shelter. Game none. |
| zs09 (Via San Ciro, Brancaccio, 2021-03) | roads and paint | The camera is on a wide paved open area with big broadleaf trees. Photo is a narrow street with parked cars along a rubble wall covered in ivy, a lamp on a pole and a pine. |
| zs09 | walls and fences | Rubble retaining wall missing. |
| zs10 (Via Falsomiele, 2019-03) | ground | A flat lime-green apron on the left with a hard edge against the road; tan plaster wall on the right. Photo is a lane of about 4 m between a dry-stone wall (left) and a plaster wall (right), with olives and a pole line. |
| zs11 (unclassified, Chiavelli, 2021-03) | facades | Camera against a plain building corner with a green door; wide road. Photo is a narrow lane lit from the front with balconied blocks and wires over the street. |
| zs12 (Viale Regione Siciliana Sud Est, main, 2026-04) | props | Good: guard rail, kerb, tall lamp, a van. A shrub ball again stands in the verge. |
| zs12 | vegetation | Photo has a group of stone pines arching on the left and wires; game has none of them. |
| zs13 (Via Brasca, Chiavelli, 2019-03) | walls and fences | A smooth tan plaster wall, 2.3 m mapped at 3 m from the camera, runs along the right. Photo has a rubble wall with brick pillars and an iron fence. |
| zs13 | props | Photo has two poles with wires and a lamp. Game none. |
| zs13 | roads and paint | Road is wider than the photo's and has large rectangular dark patches. |
| zs14 (Via Ciaculli, main, 2019-03) | facades | Good massing and shopfronts (Lotto sign, shutters, an arch). Missing: the balconies on every floor and the awnings. |
| zs14 | roads and paint | Pale large-slab pavement on both sides and a strong black crack line down the carriageway; photo's street is narrower and darker with no cracks. |
| zs15 (unclassified, Ciaculli, 2021-04) | roads and paint | The camera stands in an orchard field beside a drawn road; the photo is on a dual carriageway with steel guard rails, lamps and stone pines. A motorway link lies 13 m away and an unclassified way 6 m. I could not tell whether the photo or the road is offset. |
| zs15 | vegetation | Photo's stone pine rows along both sides are replaced by a field of small round broadleaf trees. |
| zs16 (Ciaculli, tertiary, 2019-03) | ground | A flat tan wedge cuts into the road shoulder (raycast: the `tracks` mesh, a track at 5 m). Photo has asphalt to a rubble kerb. |
| zs16 | walls and fences | Tan plaster wall on the left (2.2 m mapped, 11 m away) where the photo has a lime-washed and rubble wall with ivy, and a chain-link fence on the right. |
| zs17 (Via Valenza, Falsomiele, 2019-03) | walls and fences | A long smooth tan wall on the right (2.4 m, 5 m away) with a shop sign printed on it. Photo has a white concrete wall and a villa gate. |
| zs17 | props | Photo has a pole line with six wires, palms and mountain. Game none. (Photo road is under works with orange mesh; not counted.) |
| zs18 (Via della Martora, Falsomiele, 2021-04) | ground | A gravel-looking tan apron with pit-like patches in front of the camera (raycast: terrain, no street layer under it). Photo has a pavement, a blue iron gate and a parked car. Balconied block at the right is good. |
| zs19 (Via dell'airone, Falsomiele, 2017-09) | ground | A flat tan strip left of the road. Photo has a wide asphalt shoulder. |
| zs19 | traffic and people | Game has a row of parked cars and two sprites, which the photo (9 years old, early morning) does not. Not a defect. |
| zs20 (Viale Regione Siciliana Sud Est, Falsomiele, 2021-04) | props | Photo has a steel guard rail on the left and stone pines on both sides closing over the road. Game has a wide road, a pale kerb and two small trees. |
| zs21 (Via dell'Orsa Maggiore, Guadagna, 2019-03) | traffic and people | Good: cars parked along both kerbs, tall blocks. Photo also has a bracket lamp and scooter. |
| zs22 (Via Guadagna, 2026-04) | traffic and people | No parked cars. Photo has them nose to tail on both kerbs and wires across the street. Palms and balconied blocks are right. |
| zs22 | ground | Pale large paving slabs on the right pavement; photo's is narrow. |
| zs23 (Pomara, track, 2021-03) | walls and fences | Two tall plain tan wall blocks (mapped 2.3 m, 11 and 12 m away) and a pit in the ground. Photo is a passage with a red steel arched gate, a wall and trees. |
| zs24 (Via Benedetto Civiletti, Pomara, 2021-05) | ground | A wide flat tan apron where the street and pavement should be (raycast: terrain). Photo is a lane with a blue iron fence on a low wall. The panificio shopfront on the 3-storey block is good. |
| zs24 | props | Photo has a pole with wires, a scooter. Game none. |
| zs25 (unclassified, Pomara, 2026-04) | roads and paint | A flat tan plain and a short guard rail far to the left. Photo is a guard-railed dual carriageway with lamps and stone pines. Same pattern as zs15. |
| zs26 (Via Messina Marine, Pomara, 2021-03) | traffic and people | A white van hangs about 2 m above the road, 1 m from the camera (the object sits at y 16.4 over a ground of 14.4, raycast). Cause not found. |
| zs26 | ground | A tan terrain plain on the left (raycast), where the photo has a guard rail and a pavement; a lamp row in the photo is missing. |
| zs27 (Via Messina Marine, Roccella, 2021-04) | facades | The pharmacy and 3-storey block read right in massing; photo's is a balconied block with cracked render. Lamp poles are there. |
| zs27 | traffic and people | Photo has a parked car and a car in the lane; game empty. |
| zs28 (unclassified, Roccella, 2018-09) | ground | A huge flat tan and pale-grey slab apron, with a sprite and a row of pines far back. Photo is a road beside a noise-barrier fence with reeds and a lamp. |
| zs29 (service, Roccella, 2018-09) | walls and fences | A smooth tan wall with three dark pits along the road. Photo has a concrete retaining wall with a mesh fence on top and a sign pole. |
| zs30 (service, Roccella, 2018-09) | ground | A huge empty paved lot with a few sprites (raycast: the street verge layer under the left part). Photo is a shopping-centre car park with a hedge, a palm, parked cars and lamp poles; the low shed far back in the game is the only hint of the building. |
| zs31 (Via Padre Giuseppe Puglisi, Romagnolo, 2021-03) | walls and fences | A tall dark brown surface fills the right third (a wall or a building flank, I did not tell which). Photo has wrought-iron railings on the left, cars parked on the right kerb and a building front. Catenary wires on the left are there. |
| zs32 (Via Portella Ginestra, Romagnolo, 2021-03) | facades | Good: opticians' shopfront, balconies, bay windows, cars parked on the left. A near match, though the paving slab is paler and wider. |
| zs33 (Via Brancaccio, Settecannoli, 2015-07) | walls and fences | A tall dark corrugated flank fills the left third. Photo is a narrow street with a wooden fence and a yellow house with green shutters (photo is 11 years old). |
| zs34 (Via Paolo Borsellino, Villabate, 2021-03) | terrain and mountains | A pale bare hillside on the right where the photo has a retaining wall and a planted bank. Post-war block on the left is good. |
| zs34 | props | Photo has a lamp and a palm; game none. |
| zs35 (Via Paolo Borsellino, Villabate, 2021-03) | walls and fences | The camera stands against a tall tan plaster wall (2.6 m mapped, 1 m away) with a black crack decal; beyond is a bare yard with one lollipop tree. Photo has a road with pines, a palm, a lamp, a sign and wires. |
| zs36 (Via Terranova, Villabate centre, 2021-03) | traffic and people | No parked cars (one white van is moving). Photo has cars on both kerbs, hard up to the camera. |
| zs36 | facades | Plain blocks with a coloured rectangle band on the left; photo has balconies, shutters and ironwork in many colours. Street is wider than the photo's. |
| zs37 (service, Villabate, 2021-03) | ground | A tan wedge on the right (raycast: terrain, no street layer). Photo has trees along the verge and a lamp on a bracket. |
| zs38 (unclassified, Villabate, 2021-04) | ground | A wide tan band left of a guard-railed road. Photo is a narrow cracked lane in thick scrub with poles. Same offset question as zs15. |
| zs39 (Villabate, track, 2021-04) | ground | A flat tan strip cuts across the foreground at 0 m from the camera (raycast: the `tracks` mesh). Photo is asphalt, a lime-washed wall with graffiti and two cypress hedges. |
| zs39 | facades | A 7-storey block with scattered window squares looms behind; photo shows none. |
| zs40 (Via Nazionale, Villabate, 2021-04) | ground | The left side of the street is an empty tan plain to the horizon. Photo has terraced houses with balconies and steps and a parked car. Red-brick block with shop row at right and the lamp are good. |
| zs41 (pedestrian way, Villaggio Santa Rosalia, 2017-09) | roads and paint | Wide pale slab paving all over, no cars. Photo is an asphalt street with cars parked along both kerbs and a tree. OSM calls it pedestrian; the 2017 photo does not look like it. |
| zs42 (primary link, Villaggio Santa Rosalia, 2026-04) | props | Good: stone pines, lamp poles, railing with flowering shrub balls. Photo also has a no-entry sign and orange roadworks barrier. |
| zs43 (service, Villaggio Santa Rosalia, 2015-07) | facades | A row of shop bays with striped awnings and a balcony rail, over a wide empty paved forecourt. Photo is a white modern building with shutters, a scooter and cars at the kerb. |
| zs43 | ground | Tan terrain open lot beyond (raycast). |
| zs44 (Via Ernesto Basile, centre, 2021-04) | vegetation | Good: pollarded planes on the right in the right place. The near trunks look too fat and the crowns bare and thin; photo's are dense. Lamps on arms missing. |
| zs45 (service, Villaggio Santa Rosalia, 2026-04) | traffic and people | A flat tan lot with a pale patch and sprites (raycast: the street asphalt layer, a pale texture). Photo is a car park full of cars under pines and a palm. 6-storey blocks at the back are the right height. |

## What is systematically wrong across the zone, ranked by how visible it is to a player

Counts are viewpoints out of 45 where I saw the problem in the pair. I list ids I am confident of.

### 1. Flat tan ground beside and in place of the road (and cream cut banks on the hills)

Ids (15 of 45): flat tan in the foreground at zs04, zs16, zs18, zs24, zs26, zs28, zs30, zs37, zs38, zs39, zs43, zs45 (12); cream or pale cut banks at zs05, zs08, zs34 (3). The photos show asphalt, a pavement, a car park, a lime-washed wall or thick scrub at the same spot.

What is different from the west: the cream embankment is only a hill problem here (the Belmonte Mezzagno approach and one Villabate slope). Most of the tan is on flat ground, so the west's slope-threshold cause is not the main one.

- What I saw (raycast): two different things sit under the tan.
  - A flat vertex-coloured strip with no texture, the `tracks` mesh: `src/world.js` `buildTracks`, colour `#a48c66`, 3.5 m wide (at least 2.5), drawn as a plain ribbon with a polygon offset. It is under the tan at zs04, zs16 and zs39. At zs39 the camera is on it (0 m) and the photo is a paved street. There are 105 km of `track` ways in the box (about 571 km of drivable and track ways in all, counting a way by its midpoint), more than any class but residential, and they are painted the same everywhere.
  - Plain terrain (`terrain_x_z`, the terrain texture, no street layer under it) where the street data has nothing: zs18, zs24, zs26, zs37, zs43. At zs45 and zs30 the tan is a street layer (asphalt and verge), a pale texture, not terrain. The Comune polygons draw the carriageway and the main pavements, so forecourts, shop fronts, car parks and verges of the outskirts are left to the terrain colour (`C.plain` `#b3a685`) and paving by rule.
- Likely cause for the terrain case (a guess, not tested): the paving rule in the terrain build (`src/world.js` around the `pvf` and `paveAt` code) only paves ground close to walls inside a built-up quarter, and fades to the yard texture by `HIST_R1`. A forecourt in front of one building on a road edge fails the density test and stays tan.
- Fix size: **small** for the tracks (give the strip the yard texture or terrain colour, narrow it, drop it where an asphalt street polygon lies within a few metres). **Medium** for the terrain: extend the paved or asphalt ground rule to forecourts and car parks within a distance of a road, or bake the missing polygons (needs a rebake). **Medium** for the hill banks, as in the west survey (dark scrub tint and rubble on benched slopes beside a road).

### 2. The road edge has no furniture: poles, wires, guard rails, lamps

Ids (20 of 45 show at least one in the photo and none in the game): poles or overhead wires at zs02, zs03, zs05, zs08, zs09, zs10, zs11, zs13, zs17, zs24, zs35, zs38 (12); steel guard rails at zs03, zs04, zs05, zs15, zs20, zs26 (6); lamp posts at zs01, zs02, zs04, zs09, zs13, zs15, zs26, zs28, zs34, zs35, zs37 (11). The game does have guard rails at zs12, zs25 (far left), zs38 and railings at zs42, and lamps at zs12, zs19, zs27, zs40, zs42; those are the expressway rule and the mapped railings.

Same as the west, a little stronger in the data.

- Facts from the tiles (box counts by position): zero baked utility poles, 2 mapped lamps in the whole box, 0.0 km of guard-rail fence (`g`) against 60 km railings (`r`), 237 km of walls (`w`) and 134 km of fences (`f`). Tile props in the box: 7,382 trees, 366 bus stops, 356 shops, 171 crossings.
- Cause: the same as in the west survey. `tools/props.py` maps `utility_pole` but `src/props.js` has no model for it; guard rails only come from `src/expressway.js` and mapped rails; procedural lamps stop at the grid and the main roads.
- Fix size: **medium** for a pole row with a wire along village and rural roads; **small to medium** for guard rails on the hill and coastal roads (zs03, zs05, zs20, zs26) using the existing rail model; **small** for extending lamps to the residential streets that have houses.

### 3. Old residential and village kerbs are empty where the photos have cars on both sides

Ids (8 of 45): zs02, zs09, zs18, zs22, zs36, zs40, zs41, zs45. The game does have parked cars at zs19, zs21, zs26, zs31, zs32 and zs17, so the rule works somewhere. The misses include Via Guadagna (zs22), which is only 450 m from its anchor and about 1.6 km from Quattro Canti, so "thinner towards the outskirts" is not the whole story.

- Facts: none of the 4,952 way pieces in the box carries the baked parking tag `r.pk`, so every street runs on the class defaults (residential 0.9, tertiary 0.82, secondary 0.72). Carriageway width `cw` exists for 1.3 of 182.8 km of residential (0.7 %), 8.6 of 77.5 km of tertiary (11 %), 10.1 of 16.4 km of secondary (62 %), 12.8 of 14.6 km of primary (88 %) and nothing for unclassified or service roads, so the rest use the class default width.
- Likely cause (a guess, not traced): in `src/props.js` section 6b the loop over roads stops once the shared per-tile cap (`PK_CAP`) is reached, so roads late in the list of a dense tile get no cars; the "narrow street, one side only" coin flip, the kerb march (`e < W/2 + 0.4` rejects a road whose edge is too near) and the junction, zebra and bus-stop exclusions are the others. A test: count parked cars per tile against `PK_CAP` at zs22 and zs36.
- Fix size: **small** if it is the cap or an exclusion bug, **medium** if the village streets need their own stronger rule.

### 4. Roadside walls are smooth tan plaster where the real ones are rubble, lime-wash, concrete or railings

Ids (9 of 45): zs01, zs10, zs13, zs16, zs17, zs23, zs29, zs35, plus the dark flank at zs33. Mapped heights are 2.0 to 2.6 m and they stand 1 to 12 m from the lane (zs35 at 1 m, zs13 at 3 m, zs17 at 5 m), so they fill a third of the view. Same cause and same fix as west item 4: `src/fence-walls.js` `stretch` has no rural or hill-village branch.

- Fix size: **small** for a finish branch (rubble, lime-wash and concrete variants, lower caps); **medium** for ivy, canes and agave on top.

### 5. Roadside vegetation is missing or generic

Ids (14 of 45): stone pine rows and arches along the main roads at zs12, zs15, zs20, zs25; scrub, canes and hedges at zs03, zs08, zs38, zs39; palms, pines and planted banks at zs01, zs34, zs35, zs37, zs45; thin bare-looking planes at zs44. West had one id for the pine row (zw47); here it is the signature of the Viale Regione Siciliana Sud Est and Via Messina Marine, four photos in a row.

- Fix size: **medium**. A rule that plants a stone-pine row along the bypass and coast road, and a scrub fringe on rural edges. Tree props exist (7,382 in the box); I did not trace where they stand.

### 6. Village houses and some blocks are boxes with dark window slots

Ids (8 of 45): zs01, zs06, zs11, zs14, zs24, zs36, zs40 (left), zs43. The post-war blocks work (zs21, zs22, zs32, zs42). Not worse than the west; the Comune volumes cover this zone, so unlike the west the problem is the finish and not the footprints. Fix size: **medium** (a style pass for the old villages: balconies, shutters, colour).

### 7. Roads wider than the photos and wide plain aprons

Ids (7 of 45): zs02 (apron), zs09, zs13, zs18, zs28, zs30, zs36. Cause the same as the west: class default widths (`cw` coverage above), plus junction pieces that overlap at zs01. Fix size: **small** (narrower default for unclassified and residential lanes outside the old grid), **medium** to import `cw`, which needs a rebake.

### 8. Town centres: only two views, both far off

zs06 (Belmonte Mezzagno: a flat paved plaza with a crowd where the photo has a narrow street of balconied houses) and zs41 (a "pedestrian" way with no cars where the 2017 photo shows parked cars on asphalt). One view each, so I cannot rank them by count, but both are what a player sees on first entering a town. Cause not traced (paving polygon for zs06, the OSM tag for zs41). Fix size: **medium**, after checking the polygon.

### 9. Road and photo disagree at three views

zs15, zs25 and zs38: the photo is on a guard-railed carriageway, the game has a field or a tan band at that spot with the road a few metres off. Either Mapillary's position is off by more than 10 m on those roads or the baked geometry of the SE bypass is offset. Needs someone to compare the road polyline with the orthophoto at one of them. Fix size: unknown until checked.

### 10. Small glitches

A white van hangs 2 m above the road at zs26 (cause not found). Low-poly shrub balls in bright green and pink at zs01 and zs12, which read as toys beside the photographed hedges (`prop_shrub`). Black crack decals stronger than the photo's at zs14 and zs35, and large dark rectangular patches in the asphalt at zs13, zs14, zs37 (west item 6 again). Fix size: **small** each.

### Which of the west's top items hold here

| West item | Here |
|---|---|
| Pale cut-bank ground | Partly. Only 3 of 45 (zs05, zs08, zs34). The dominant ground problem is flat tan on level ground, from the `tracks` mesh and unpaved terrain, 12 of 45. |
| Empty streets | Yes, 8 of 45, though some streets do have cars, so it is patchy and not absent. |
| No rural road furniture | Yes and stronger: 20 of 45, with zero mapped guard rail, two mapped lamps and no pole prop in the box. |
| Smooth tan plaster walls | Yes, 9 of 45. |
| Missing village-edge buildings | Mostly no. Only zs07 is a clear case (0 buildings within 100 m, 129 m to the nearest). zs05, zs08 and zs37 have none within 100 m too, but their photos show no houses either. |
| Over-wide plain roads | Yes, weaker, 7 of 45. |
| Flat facades | Yes for old villages, 8 of 45, but the post-war blocks are good. |

## What I could not judge

- Croce Verde Giardina: not located, no viewpoint. Brancaccio, Settecannoli, Romagnolo and Bandita each have one or two viewpoints; their dense streets are under-sampled.
- Town centres: four centre-class viewpoints (zs06, zs36, zs41, zs44), none in Brancaccio, Settecannoli or Ciaculli.
- Belmonte Mezzagno: four viewpoints, one in the centre. The south edge of the baked map is at z 7817, which is just past the town's anchor (z 7428); I did not look at what the map holds beyond that.
- Anything off the roads Mapillary covers, so plots between lanes are judged only by the three country viewpoints.
- Lighting: every shot is 11:00. Chase camera against the 1.6 m eye height used here.
- The causes in items 1 (terrain case), 3, 5, 6 and 9 are suspicions from reading code and data. Only the `tracks` mesh and the terrain mesh under the tan are confirmed (raycast, one run), nothing was changed to test a fix.

## Reproducing

`docs/faithfulness/survey/zone-south-east-places.json` lists the viewpoints. The game shots come from `tools/faith_shoot.mjs` with a `meta/<id>.json` per viewpoint (lat, lon, heading) built from the Mapillary photo position, shot against a `git archive` snapshot served on its own port. The photo search and download scripts were written ad hoc for this survey and are not in the repo; the photos stay outside it.
