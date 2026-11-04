# Faithfulness survey, zone WEST and SOUTH-WEST: the game against Mapillary photos

Date: 4 November 2026. Game commit shot: c96e15d (a `git archive` snapshot of HEAD served on its own port, so other people's edits did not change the round). One reviewer, one pass, no game changes. Nothing here is copied from a photo; the photos were looked at and live outside the repo.

Zone: Borgo Nuovo, Bellolampo, Inserra, Passo di Rigano, Uditore, Boccadifalco, Baida, Altarello, Monreale, Molara, Villagrazia, Pagliarelli, with the hills and country lanes between them. In game metres that is roughly x -9600 to -2400 and z -5200 to 4900. District names on the viewpoints below are approximate: each viewpoint got the nearest of my own anchor points (street names from the tile data and a few coordinates from memory), not a boundary file, so "Borgo Nuovo" in particular is a guess.

## What was compared

- **49 viewpoints, 49 photo pairs, all shot and all looked at.** Game camera at the photo's own position and heading, 1.6 m up, 60 degrees vertical fov, 11:00, UI and car hidden, 1024 by 768, 4.5 s of settle after the world reported itself calm. 49 of 49 shot on the first pass, no page errors. Sheets read: 9 contact sheets (6 pairs each, 384 by 288 per picture), plus 5 full size game shots (zw01, zw11, zw14, zw21, zw47) and the zw23 pick to check detail. Small detail (a sign, a fence type) is weak evidence on the sheets and I say so where it matters.
- **How the viewpoints were chosen.** Round 3's viewpoints are sparse out here, so these are all new. First pass: 69 road points picked blind from `world/tiles/*.json` (main, residential, edge of town, piazza, track), each searched for a Mapillary photo within 35 m. Only 23 of the 69 had one: none of the 18 edge-of-town points, none of the 5 country tracks, none of the 2 piazzas I tried (Piazza Molara, Piazza San Paolo), 4 of the 22 residential points. Mapillary in this zone is almost entirely main roads: I counted 29,791 non-panoramic images over the zone, and by class of the nearest road 23,278 on main roads, 3,848 residential, 490 edge of town, 35 piazza, 10 country.
- **So the final set is photo positions that lie on a road.** From those 29,791 images I kept the ones within 7 m of a real road centreline in the tiles and looking along it (within 30 degrees), then picked by farthest-point sampling per class (main 13, residential 13, edge 12, country 1, piazza 2; the two piazzas and one residential point lay east of the zone and were dropped), and added one more per named district (11, all on main roads, because that is what has photos). Result by class: 24 main road, 12 edge of town, 12 residential, 1 country track. **0 town-centre or piazza viewpoints with a photo**; Monreale's old town (zw14) is the nearest thing. This is a real hole in what I can judge: the squares of Molara, Passo di Rigano, Boccadifalco and Pagliarelli have no usable photo within reach.
- **Photo age.** 49 of 49 usable (they were picked from existing photos, so that says nothing about coverage; the 23 of 69 above does). Median age 7.7 years, range 2.5 to 8.7. By capture month: 34 are March 2019, 3 are April 2024, 6 are 2021, 6 are 2018 or February 2019. Seven years of difference matters little for walls and slopes and a lot for shops, parked cars and roadworks; I did not count any of those as defects.
- **Photos are CC BY-SA and were never put in the repo.** The token was read from the main checkout's `data/mapillary_token` by my own small scripts and sent only as a request header; I passed the file path to the scripts instead of making a symlink in the worktree, so there is no link to remove. Nothing about the token was printed or stored.
- Places list: `docs/faithfulness/survey/zone-west-places.json` (id, game x and z, road, class, Mapillary image id, heading, age). It holds no pixels.

Caveats, as in round 3. A phone compass heading is not always right, and a dashboard or windscreen shows in many of the photos. Walking sprites sometimes stand in front of the lens (zw01, zw02, zw09, zw30, zw44 have them) and traffic and parked cars in the photos are of their day. Statuses are from one person looking at thumbnails once.

## Verdict in a few lines

The big boulevards and tram avenues in the east of the zone are close to the photos (zw25, zw27, zw40, zw45, zw46 are the best of the 49: rails, railings, poles, post-war blocks with a shop row, bare planes all there). Everything that is not a boulevard is much further from the photos: the hill roads of Monreale, Baida, Boccadifalco and Bellolampo, the village streets, the lanes between plots. Their problem is not one wrong object. It is that the ground beside the road, the walls, the roadside plants and poles and the parked cars are all missing or drawn as one generic thing, so a drive through the west reads as "grey ribbon on a pale hill" where the real road is a narrow lane between stone, hedge, pines and wires.

## Findings per viewpoint

Layers: ground, facades, buildings missing, walls and fences, vegetation, roads and paint, terrain and mountains, props, traffic and people. "Game" is what I saw in the shot, "photo" what the Mapillary picture shows.

| id | layer | finding |
|---|---|---|
| zw01 (far W hills, junction of three lanes, photo 2019-03) | roads and paint | Three roads (residential 6 m, tertiary 8 m, service 4 m) come together within 10 m of the camera and are drawn as one grey apron about 14 m wide with a dark flat quad lying on it. The photo is a single lane about 5 m wide. |
| zw01 | walls and fences | Photo has a plaster wall and an iron fence on the right with villas behind it and a hedge. Game has bare hillside and a tan band. |
| zw01 | buildings missing | No building within 100 m in the tiles; the photo has houses right and left. |
| zw01 | props | Photo has lamp posts and a pole line. Game has none. |
| zw02 (far W hills, pine road, 2019-03) | vegetation | Good: a tunnel of pine crowns over the road, close to the photo. |
| zw02 | roads and paint | A dark, tilted flat plane crosses the road and verge in front of the camera (a ghost slab). Road is wider than the photo's. |
| zw02 | walls and fences | Photo has a rubble retaining wall on the right and a steel guard rail on the left. Game has neither. |
| zw03 (far W hills, curve with parapet, 2019-03) | terrain and mountains | A smooth cream bank fills the left of the view at 3 m. The photo has a dry-stone parapet on the left, a rock cut and olives, a guard rail on the right. |
| zw03 | props | No warning sign, no pole, no guard rail. Parked cars stand along the left edge of a mountain road. |
| zw04 (far W, olive road, 2021-06) | ground | A 3 m band of tan with a cobbled strip beside it on the right, and a wide yellow shoulder on the left. Photo is asphalt to a low rubble parapet, olives and a pole line. |
| zw04 | props | Pole line and wires missing. |
| zw05 (Via Regione Siciliana, hills W of Monreale, 2019-03) | terrain and mountains | Cream embankment on the right with a tan band where the photo has an ochre rock cut with grass on top. |
| zw05 | vegetation | Photo road runs under a dense pine crown. Game has sparse small trees and open sky. |
| zw05 | props | Photo has a lamp pole, game none. |
| zw06 (W hills above Baida, 2019-03) | vegetation | Good: pines on a slope, trunks and crowns in the right place. Ground under them is lime green; the photo's is dry needle litter. |
| zw06 | props | Photo has a guard rail and a chevron sign on the bend. Game has neither. |
| zw07 (Bellolampo, secondary road, 2019-03) | terrain and mountains | Photo's slope is bright grey limestone scree with pines; game's is olive-green with sparse crowns. The road itself, the edge lines and the umbrella pines read right. |
| zw07 | roads and paint | A pale kerbed strip runs along the left of a mountain road; the photo has a guard rail at the edge. |
| zw08 (Bellolampo, secondary road, 2019-03) | walls and fences | A tall plain plaster wall on the right where the photo has a vegetated bank over a low stone wall; guard rail on the left in the photo, none in the game. |
| zw08 | roads and paint | Good: edge lines, centre dashes and worn asphalt are about right. |
| zw09 (Via Pietro Novelli, Monreale, 2021-06) | roads and paint | Three ways (service, tertiary, unclassified, all named Via Pietro Novelli) lie within 3 to 11 m of the camera; the game shows stacked road ribbons on cut terraces and a dark slab. Photo is one narrow street. I did not check whether these are switchbacks or duplicated ways. |
| zw09 | buildings missing | No building within 100 m. Photo has a house with a terrace at left, a wall, poles and a lamp. |
| zw09 | terrain and mountains | Bare pale hillside; the photo's cut is covered in scrub. |
| zw10 (Bellolampo road down to Monreale, 2019-03) | ground | Wide beige gravel apron on both sides, the asphalt of the photo runs to a narrow kerb. |
| zw10 | props | Photo has a lattice pylon, a fence and a road sign at the left; none in the game. Low-rise town at left of the game is plausible. |
| zw11 (Via del Monte, Monreale, 2021-06) | terrain and mountains | Camera stands on a pale cream cut bank with a yellow stripe at the road edge; the road is on a shelf above an empty valley. |
| zw11 | buildings missing | Zero buildings within 100 m. The photo is a street of houses on a hill with a stone wall and steps, a wooden fence, parked cars, a pine. One tower block far off in the game is all that is there. |
| zw12 (Via Archimede, Monreale, 2019-03) | facades | Massing is right (36 % footprint, blocks of 4 to 6 storeys). Facades are beige boxes with dark window slots and no balconies or shutters; the photo's are pink and ochre with a balcony on every floor and a shop awning. |
| zw12 | traffic and people | Parked cars and a van on the right kerb are there. Good. |
| zw13 (Via Alla Falconara, Baida, 2019-03) | props | Photo has overhead wires and several poles, a street sign, a kerbed island. Game has a low brick wall and a grey sloped slab by the kerb. |
| zw13 | facades | Villas read as plain boxes; the photo's have terraces and tiled gables. |
| zw14 (Via Palermo, Monreale old town, 2019-03) | terrain and mountains | A smooth tan ramp of terrain stands where the right side of the street should be (a ruined palazzo and parked cars in the photo). |
| zw14 | facades | Left side is a tall, flat, windowed wall (blue shutters, good), but the photo has narrow balconied houses of 4 to 5 storeys with iron balconies and awnings. On the right a tall cut-stone block with arched windows stands on the ramp; the photo has a half-ruined palazzo and a hoarding there. |
| zw14 | traffic and people | Photo has cars parked tight on both kerbs and people talking in the road. Game has an empty road. |
| zw15 (lane S of Monreale, 2018-08, portrait photo) | buildings missing | Zero buildings within 100 m; photo has a house ahead, a wall, a pole line. |
| zw15 | ground | Wide tan shoulder and cobbled kerb strip on the right; photo is a 4 m lane with an olive and a stone wall. |
| zw15 | roads and paint | Three roads (6 and 8 m) within 17 m; the game lane is about twice as wide as the photo's. |
| zw16 (service lane, Monreale slopes, 2019-03) | walls and fences | Corridor between two tall plain plaster walls. Photo: a rock cut with prickly pear, broom and flowers on the left, open on the right, a blue bin. |
| zw16 | ground | Flat tan-green strip beside the road, no vegetation. |
| zw17 (Via Santa Liberata, Monreale, 2019-03) | walls and fences | A tall smooth plaster wall on the right and a plain block on the left. Photo: villas with hedges, palms, an iron gate, a shop sign, overhead wires. |
| zw17 | vegetation | No palms, hedges or garden trees at all. |
| zw18 (Via Bronte, Passo di Rigano W, 2019-03) | vegetation | Photo has a continuous row of big evergreen trees on the far side and plane trees; game has one or two small trees at the end of the street and none along the kerb. |
| zw18 | roads and paint | Photo has a zebra crossing and a double edge line. Game is a very wide asphalt bowl with one centre dash. |
| zw18 | traffic and people | Cars parked far off in both. In the photo they line the kerb in front of the camera. |
| zw19 (Via Strada Ferrata, Monreale, 2019-03) | terrain and mountains | A tan strip and cream embankment at the road edge, with a grey shelf on the left. Far slope with houses reads well. |
| zw19 | props | Photo has a steel guard rail the whole way on the right and a scrub verge. Game has none. |
| zw20 (Via Alla Falconara, by the Boccadifalco airfield, 2019-03) | ground | The airfield side is a flat tan plain to the horizon. Photo is a long black iron railing on a concrete plinth with a pavement behind it. |
| zw20 | props | Photo has a row of lamp posts and trees on the left; game none. |
| zw20 | traffic and people | Photo has a white car, a second behind it and a row of parked cars on the left. |
| zw21 (Via Torrente d'Inverno, 2019-03) | walls and fences | Photo is a 4 m ashlar and rubble retaining wall with agave and grass on top, and a guard rail. Game has a tan slope and a bright sand patch. |
| zw21 | roads and paint | The sand patches overlap the asphalt with a hard edge, and their bright yellow colour is not the colour of the real shoulder. |
| zw21 | vegetation | Good: a stand of broadleaf trees and a terraced hillside with houses. |
| zw22 (Via Cannolicchio, 2019-03) | walls and fences | Two tall plain plaster walls, 2.2 to 2.4 m mapped, one on each side. Photo has a rubble wall on the right and a hedge with a fence on the left, grass in the middle of the lane. The tile data has three wall pieces 3, 4 and 7 m from the camera, 2.2 to 2.4 m high, so it is the finish that is wrong. |
| zw22 | roads and paint | Lane is about 6 m wide in the game; in the photo it is under 4 m with cars squeezed through. |
| zw23 (Via Ponte Parco, S of Molara, 2019-03) | roads and paint | Two roads (8 m and 6 m) 3 m apart: the game shows a very wide apron with a dark strip in the middle, a ghost median. Photo is a single curve with a guard rail. |
| zw23 | props | Photo has two poles with wires, a street lamp and a guard rail. Game none. |
| zw23 | vegetation | Photo has olives and dense bush each side; game has a walled yard and bare hill. |
| zw24 (Via Baracca, Boccadifalco, 2019-03) | facades | Game has a tall tan block with a door at the right (good) and a flat apartment row at the left. Photo is terraced houses with balconies, awnings, scooters. |
| zw24 | traffic and people | Photo has cars parked on both kerbs. Game has one car at the left. Street is wider than the photo's. |
| zw25 (Viale Michelangelo, Passo di Rigano, 2019-03) | props | Good. Tram wires, railings and pollarded planes all there. Photo also has a billboard and a lorry; game lacks them. |
| zw26 (Via Roccazzo, Passo di Rigano, 2019-03) | walls and fences | Tall plain plaster wall on the left. Photo has a green corrugated noise barrier on a stone wall, floodlight masts, parked cars along both kerbs, a zebra. |
| zw26 | facades | Good: the right side has balconies in every bay and a bakery shopfront. |
| zw27 (Viale Leonardo da Vinci, Passo di Rigano, 2019-03) | roads and paint | Good: tram rails, railing, wires, blocks with a shop row. A near match. |
| zw27 | traffic and people | Photo has cars parked at the right kerb and a car in the lane. |
| zw28 (Raccordo per Via Belgio, N end of the zone, 2024-04) | props | Good: a median barrier, lamps, three lanes. Photo has steel guard rails on both sides, a green glass-front industrial building and cloudy sky; game has the barrier on one side only. |
| zw29 (service lane between Boccadifalco and Pagliarelli, 2018-02) | facades | Camera stands against a blank tan plaster wall with a grey poster. Photo is a white public building with air conditioners, a barrier arm and a car-park sign. |
| zw30 (lane E of Boccadifalco, 2019-03) | ground | Paving slabs across the foreground of a plain asphalt street (a pale, large-tile apron). Photo is asphalt with paint on it and a kerb. |
| zw30 | walls and fences | Photo has an ivy-covered wall with a roller shutter behind it. Game has a low tan wall and a tree. |
| zw30 | traffic and people | A crowd of five or six sprites stands in the road. |
| zw31 (Via Aquino, Molara, 2018-10) | traffic and people | Photo is one lane of traffic and a van with parked cars on the left. Game is empty. |
| zw31 | roads and paint | Game's black crack lines on the asphalt are much stronger than the photo's. |
| zw31 | walls and fences | Iron railing on the left and a wall with a railing on the right are about right. |
| zw32 (Via di Blasi, Passo di Rigano, 2019-03) | walls and fences | A flat dark-green hedge slab 2 m tall on the right; photo has a low dry-stone wall topped with green mesh netting and a hedge. |
| zw32 | props | Photo has a road sign and a lamp. Game has none. |
| zw33 (Viale Regione Siciliana NO, Inserra, 2021-05) | roads and paint | Photo is a dual carriageway with a double steel guard rail, a wide hard shoulder and a gantry. Game is a 2-lane road beside a low brick wall and a shrub ball, no gantry. |
| zw34 (Via Olio di Lino, Molara, 2019-03) | facades | Camera ends up facing a smooth beige box wall with no windows, taller than the frame. Photo is a bend with a dry-stone wall, a tree and a lamp pole. |
| zw35 (Viale Michelangelo, Uditore, 2019-03) | vegetation | Good for the bare planes. Photo also has an evergreen pine and plane mix on the right. |
| zw35 | roads and paint | Reads about twice as wide as the photo's; I did not check why. |
| zw36 (Via Pitrè, Altarello, 2019-03) | traffic and people | Photo has cars parked on both kerbs and a hedge. Game has dumpsters and no parked cars. |
| zw36 | roads and paint | Good lane lines, but three lanes drawn where the photo has two plus parking. |
| zw37 (side street, Pagliarelli, 2021-03) | ground | Three black pits and a patch of paving slab in the street. Photo is smooth asphalt. |
| zw37 | walls and fences | A long smooth tan wall on the right; photo has a low plastered house with a green door and a car in front. |
| zw38 (Via Sambucia, Villagrazia, 2019-03) | walls and fences | Photo is a tall iron fence over a stone footing. Game has a pale stone median or kerb strip down the middle and a plain wall. |
| zw39 (Viale Regione Siciliana NO, Cruillas, 2024-04) | roads and paint | Good: a wide carriageway, guard rail on the right, big umbrella pine on the left. Photo has scrub on the median, a turn arrow and a pine. |
| zw40 (Viale Leonardo da Vinci, Uditore, 2019-03) | roads and paint | Good: tram rails, railing, wires, 6 to 11 storey blocks, one of the closest pairs of the 49. |
| zw40 | traffic and people | Photo has parked cars on both sides. |
| zw41 (country track, Pagliarelli, 2019-03) | ground | An orange-tan dirt strip with cars on it. Photo is a narrow asphalt lane between a corrugated fence and a white lime wall with giant reed above it. |
| zw41 | walls and fences | Plain tan walls on both sides; the photo's right wall is rough white lime plaster. |
| zw42 (Via Villagrazia S, 2019-03) | roads and paint | A bowl-shaped pit in the middle of a very wide asphalt street, overhead tram-style pole in the middle. Photo is a narrow street with houses and a row of parked cars, a lamp on a bracket. |
| zw42 | props | The pole on the left of the road in the game is not in the photo. |
| zw43 (service road at a fuel station, Borgo Nuovo/Altarello, 2019-02) | props | Photo is a Q8 forecourt with a pump island and a canopy. Game has an orange-roofed garage and paving slabs. The canopy is missing. |
| zw44 (Viale Regione Siciliana side road, Uditore E, 2024-04) | roads and paint | A wide tan sand strip lies on the carriageway and white slabs at the left. Photo is bumper-to-bumper traffic with a planted verge on the left. |
| zw44 | facades | Good: balconied post-war blocks with a ground-floor shop row. |
| zw45 (Viale Regione Siciliana NO, Borgo Nuovo, 2018-06) | props | Good: guard rail, trees, overhead pole and wire. Photo has a lattice footbridge and lamp posts that the game lacks. |
| zw46 (Viale Regione Siciliana SE, Pagliarelli, 2021-04) | props | Photo has a guard rail on the right, tall lamp posts, a billboard. Game has a kerb and a low box building. |
| zw47 (Viale Regione Siciliana NO, Cruillas, 2019-03) | facades | A 14-storey tower with almost no balconies and a scatter of dark window squares. Photo has balcony strips on every floor. |
| zw47 | roads and paint | Wide road with large rectangular dark patches in the asphalt that look like a patchwork. |
| zw47 | vegetation | Photo has a stone pine row and a guard rail along the road; the game has a few small trees. |
| zw48 (secondary road, Villagrazia, 2018-02) | ground | A tan strip in the middle of the road and a pale flat shoulder. Photo is a road with guard rails on both sides. |
| zw49 (Via Villagrazia, 2019-03) | roads and paint | A white paving wedge (an island) and a plain wall at the right. Photo is a big tree over parked cars. |
| zw49 | vegetation | One huge broadleaf tree in the photo, none in the game. |
| zw49 | traffic and people | Cars parked all along the left in the photo. |

## What is systematically wrong across the zone, ranked by how visible it is to a player

Counts are viewpoints out of 49 where I saw the problem in the pair. I list the ids that I am confident of; a few ambiguous ones are left out.

### 1. The ground beside the road is pale cream or flat tan, with yellow bands, and the cuts are smooth cream ramps

Ids (17 of 49): zw03, zw04, zw05, zw08, zw09, zw10, zw11, zw14, zw15, zw16, zw17, zw19, zw20, zw21, zw41, zw44, zw48. It is the first thing you see on every hill road in Monreale, Baida, Bellolampo and Boccadifalco: a smooth cream bank at the road edge, a tan band (sometimes saturated yellow with brown blotches, hard-edged, lying across the asphalt as at zw21) and, at the airfield (zw20), a flat tan plain to the horizon. The photos have scrub, rubble parapets, rock cuts, agave, grass or asphalt to the kerb.

- What I saw: the band and the bank share the same tint and mottling, so they look like the terrain's own colour, not a street layer; at zw20 the tile has no land-cover polygon near the camera (checked in the tile data), at zw21 only a forest polygon beyond it.
- Likely cause (a guess, not tested): `src/world.js` `terrainColor`. Lowland ground defaults to `C.plain` (#b3a685), and anything steeper than a gradient of about 0.38 goes to a cream limestone `C.rock` (#c6c0b2). A road bench cut into a hill is exactly such a slope, so every cut and fill becomes limestone cream, whatever it is in life. Land-cover polygons (`COVER`, from `areas[]`) only override this where OSM has tagged scrub or wood. The yellow shoulder bands may be the same terrain showing through between the asphalt and the verge polygons.
- Fix size: **medium**. A rule in `terrainColor` or the bench step (dark scrub colour and a rubble or rock texture on benched slopes next to a road, paler only above a height) fixes the tint without a rebake; a rubble retaining wall on cuts and fills is a bigger addition. A quick test to confirm the cause before building: shoot zw21 and zw11 with the rock threshold raised in the console. I did not do it.

### 2. Streets in the west are empty: parked cars, street trees, crossings and kerbside hedges are missing

Ids (9 of 49): zw18, zw24, zw26, zw31, zw36, zw38, zw42, zw49, plus zw20 (kerb row). The real west is a place of cars on every kerb, a plane or evergreen at the edge and a zebra at the corner. In the game the streets are wide empty asphalt.

- Facts from the tiles (I counted them over the 7 km by 10 km zone box): of 240 km of residential roads, 0.1 % have a mapped parking lane; for tertiary (96 km), unclassified (73 km), service (82 km) and secondary (22 km) it is 0 %. The real carriageway width (`cw`) exists for 5 % of residential roads, 10 % of tertiary, 11 % of secondary, 100 % of primary; everything else gets the class default (residential and unclassified 6 m, tertiary 8 m, service 4 m, secondary 10 m). So the zone is drawn with default widths and no mapped parking.
- The parking rule in `src/props.js` (section 6b) is supposed to cover this: "elsewhere parallel, thinner towards the outskirts", class occupancy 0.9 for residential and 0.82 for tertiary, never below 0.6 of that far out. I saw cars at kerbs at zw12, zw21 and zw03, and none at zw24, zw26, zw31, zw36, zw42, zw49. I did not trace why. Things to check first: the "on a narrow street one side takes the cars" coin flip, the junction and zebra exclusions, and the bridge and tunnel flags (`r.br`, `r.tn`) that skip a road.
- Street trees: the planting code (`props.js` section 9 and `src/species.js`) targets the named avenues and wide pavements; the zone box has 9,855 baked tree props and I did not check where they stand; none of the 49 game shots has a tree row along a residential kerb, while zw18 and zw49 photos have big trees leaning over the street.
- Fix size: **medium**. Parked cars: tune or debug the existing rule (small if it is a bug, medium if it needs a stronger default for residential streets of the old villages). Street trees along residential streets: a new rule, medium. Real widths: needs a map rebake only if you want to import the Comune widths (`cw` is the Comune carriageway); defaulting rural lanes narrower is small.

### 3. The countryside roads have no furniture: no pole lines, no guard rails, no signs, no lamp posts

Ids (poles or wires in the photo: zw04, zw05, zw09, zw10, zw13, zw15, zw17, zw23, zw31, zw34, zw42, zw49; guard rails: zw02, zw03, zw06, zw07, zw08, zw19, zw21, zw23, zw28, zw33, zw46, zw48; lamp posts: zw01, zw20, zw32). 26 of 49 have at least one. In the game the road edge is bare.

- Cause, seen in the code and data: `tools/props.py` maps OSM `utility_pole` to a prop kind, but `src/props.js` has no model for it; there is no pole or wire code outside the tram catenary (`src/trams.js`). I checked: zero utility poles in the zone box's tiles, and 81 mapped lamps along about 530 km of drivable road (primary to residential, service and unclassified). Steel guard rails only come from the expressway rule (`src/expressway.js`) and mapped rails: fence kind `g` is 0.7 km in the zone box.
- Fix size: **medium**. A pole row with a thin wire along rural and village roads (placed by rule on one side, every 35 m or so, carrying a single line mesh like the tram wire) is a new prop plus a placement rule; guard rails on hill roads next to a drop is a rule on top of the existing rail model, small to medium. Lamp posts: the procedural lamps (section 4 of `props.js`) follow only the primary to tertiary roads and the residential grid; extending them to rural lanes with houses is small.

### 4. Roadside walls are smooth tan plaster where the real ones are dry stone, hedge, railing or rock cut

Ids (10 of 49): zw08, zw16, zw17, zw22, zw26, zw29, zw34, zw37, zw41, zw49; a flat box hedge at zw32; the airfield railing missing at zw20; the retaining wall missing at zw21. The mapped heights are 1.7 to 2.8 m, but they stand 1 to 5 m from the lane, so they fill half the screen when you drive past.

- Cause: `src/fence-walls.js` (`stretch`) re-reads every mapped fence within 8 m of a road. For frontage with a building within 14 m (outside the old town and green land cover) it picks `keep` 25 %, `plaster` 33 %, `low` 22 %, `stone` 12 %, `block` 8 %; for open ground `keep` 55 %, `low` 18 %, `block` 12 %, `stone` 8 %, a short hoarding or plaster for the rest; plaster pieces are 1.7 to 2.6 m high. There is no hill-village or rural branch, so a Monreale lane gets the same mix as a side street in the Libertà belt. In the zone the fence data is 418 km of wall pieces (`w`), 387 km of fence (`f`), 54 km railings (`r`). The walls at zw22 are confirmed by the tile data (three wall pieces at 3, 4 and 7 m, 2.2 to 2.4 m high). What is wrong is the finish; I did not measure zw16 and zw34, which look taller than any mapped height and may be buildings drawn as walls.
- Fix size: **small** for the finish (a rural and hill-village branch in `stretch` that favours the `stone` and rubble layers, lime-washed plaster and vegetation fringes, and a mapped-height cap); **medium** if you want ivy, agave and prickly pear over the walls, since that is new geometry or a texture layer.

### 5. Villages and plots at the edge of the built-up area are missing buildings

Ids (6 of 49): zw01, zw09, zw11, zw14, zw15, zw17. Tile data confirms: 0 buildings within 100 m of zw01, zw09, zw11 and zw15, 4 at zw17 (and 0 at zw02, zw04, zw07, zw19, zw23, where I judged the photo's houses too far to count). The photos show houses at the first five, at zw11 an entire street of them.

- Likely cause: data. The tiles carry nothing at these spots. OSM and the Comune's volumes (2013, `tools/footprints.py`) are the sources; I did not check which of them has the houses or whether the bake dropped them. `docs/faithfulness/survey/SUMMARY.md` ranked missing buildings second in round 1; this is the same thing in a different place.
- Fix size: **needs a map rebake** and a new or better footprint source (large if no source covers it; I did not look for one).

### 6. Roads are wider and plainer than the real ones, with stacked ways, ghost slabs and pit decals

Ids: wider than the photo: zw15, zw18, zw22, zw24, zw35, zw36, zw42; stacked ways or ghost quads: zw01, zw02, zw09, zw15, zw23, zw44; pits: zw37, zw42. Patches in the asphalt look like a quilt (large dark rectangles at zw01, zw21, zw42, zw47).

- Facts: widths are class defaults (see item 2). At zw01, zw09, zw15 and zw23 two or three OSM ways run within 3 to 17 m of the camera and are drawn as one fat apron; whether they are switchbacks or duplicates I did not check. The dark flat quads at zw01, zw02 and the dark strip at zw23 are not explained by anything I looked at; I did not find them in the street layers.
- Fix size: **medium** and mixed. Narrower default widths for rural unclassified and residential roads: small. Hunting down the ghost quads: unknown until someone inspects the street layers there. The rectangular wear patches: `src/roadwear.js` or the asphalt texture, small.

### 7. Facades and tall blocks look like boxes with dark windows

Ids: zw12, zw13, zw14, zw24, zw29, zw34, zw47. The new post-war style works on the boulevards (zw26 right side, zw27, zw40, zw44), but the village and edge blocks, and the 14-storey tower at zw47, read as plaster boxes with scattered dark squares and no balconies, awnings or shutters. Photo facades in Monreale and Boccadifalco are 4 to 5 storey with iron balconies and a lot of colour.

- Likely cause: the zone styles in `src/districts.js` (the seeds there for this area are `periph`, `rural`, `rigano` and `uditore`) are not the post-war balcony style that works on the boulevards; I did not trace which style each building here got.
- Fix size: **medium**. A style or tuning pass over the outskirts zones.

### 8. Terrain: hills read as hills, with the colour caveat above

Not in the ranked list because it is mostly right. zw02, zw06, zw07, zw21 and the far slopes at zw01, zw23 have the right massing, rock bands and sparse pines. What is off is the colour (item 1) and the scree: the photo at zw07 is bright limestone, the game olive.

## What I could not judge

- Squares and town centres: no photo within reach of Piazza Molara or Piazza San Paolo, and no edge-of-town lane candidate had one either. Borgo Nuovo itself I could not locate with confidence.
- Anything off the roads Mapillary covers (the zone has 29,791 photos, nearly all on main roads), so the plots between lanes and the country tracks are judged only by two viewpoints.
- Colour of walls and facades under another light; every shot is 11:00.
- Whether a player in the car, with the chase camera, sees the same as the 1.6 m eye height used here.
- The causes in items 1, 2, 6 and 7 are suspicions from reading the code and data; none was tested by changing anything.

## Reproducing

`docs/faithfulness/survey/zone-west-places.json` lists the viewpoints. The game shots come from `tools/faith_shoot.mjs` with a `meta/<id>.json` per viewpoint (lat, lon, heading) built from the Mapillary photo position; the photos were downloaded by id with a header-only token from `data/mapillary_token`, and stay outside the repo.
