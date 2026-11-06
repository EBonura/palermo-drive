# The towns around Palermo: a recipe

Villabate was the first. Monreale, Isola delle Femmine and Bellolampo take the same steps. What is general is in code that already exists and is reused as is; what is Villabate only is a handful of data lines and one landmark file.

## What Villabate looked like (Mapillary, March to April 2021, 54 photos at 37 viewpoints and the churches, looked at only, nothing copied)

- A grid of narrow streets (wall to wall 4.5 to 7 m on the side streets, measured on the baked footprints, so the 6 m class width is right) along a long corso (Corso Vittorio Emanuele, 10 m carriageway, parked cars both sides, wall to wall 13 to 21 m).
- 2 to 5 storey houses and 4 to 6 storey post-war blocks side by side, flat roofs, deep balconies with iron or glass rails, a stone or brick plinth under pastel plaster: ochre, salmon, peach, putty, white, now and then pale green or blue, a brick red.
- Ground floors: the roller shutter is the commonest front, then a plain door, a shop, a bar, a pharmacy (green cross), a fruit and vegetable stall with a striped awning on the pavement.
- Cars nose to tail on both kerbs, stone pines in the squares, the mountain close behind, a green noise barrier along the road at the east edge.
- The Chiesa Madre (Sant'Agata) stands inside a block between two lanes; no street photo shows its front. The Chiesa di San Giuseppe is modern: a low hall and a slender tapering concrete bell tower behind iron railings, palms and globe lamps.

## The recipe

1. **Look first.** `tools/mapillary_extra.py` style: ask the Mapillary Graph API for the images in the town's box, pick 40 viewpoints (centre, corso, side streets, church, edge, station), shoot the game at the same position and heading with `tools/faith_shoot.mjs` (a `meta/<id>.json` per viewpoint), read the sheets from `tools/faith_sheet.py`. The token is read from `data/mapillary_token` by your own script and sent as a header only.
2. **The zone** (src/districts.js, general). Copy the `villabate` entry of `ZONES`: palette (`plaster`), `fl` and `fh` (storeys), `w` (style mix: `n19`, `res`, `pal`, `blk`, `pw`), `elig: true`, `town: true`, `front` (how far behind a lane a facade still counts as a street front; 7 in a town of narrow lanes). `town: true` is what switches on the old-town facade machinery (buildings.js `old`: aged render, stone surrounds, tall shuttered windows, balconies in runs, passages) while keeping the zone's own palette and ground floors. Add 4 to 6 seeds to `SEEDS_LL` (`[zone, lat, lon, reach]`, one per part of the town; a building takes the nearest seed in units of reach) and a line to `TOWNS_LL` (the name the HUD shows).
3. **Street names.** `zoneAt` sends Via Roma and every Corso Vittorio Emanuele, Via Verdi and so on to the centro's zones. Inside a town zone's seeds they now stay the town's: nothing to do, but a town without its own zone yet keeps the old behaviour.
4. **Ground floors** (buildings.js `TOWN_GROUND`, general): four lists (market, main, side, minor street kind), roller shutters first. Edit the weights if the town differs (a town with a market street names it in `MARKET_FRONT`).
5. **Names in the HUD** (`townAt` in districts.js, used by src/danger-hud.js): the ISTAT neighbourhood grid has nothing outside Palermo, so the HUD said Palermo. One line in `TOWNS_LL`.
6. **Landmarks** (src/lmc-towns.js, one file for all the towns; register in src/landmarks-city.js through `TOWN_LANDMARKS`). Take the OSM footprint id and outline from the tile, use `src/lmc-kit.js` (`prism`, `panel`, `gable`, `paintFacade`, `frame`), `skipIds` hides the generic building, `radius` is the build range. Never draw what no photo or source shows as fact: say so in the file header.
7. **Heights.** Named buildings without lidar or levels carry a generic 18 to 22 m (a villino, an old station, a bandstand); in a `town` zone `applyDistrictHeights` now treats a name alone as no reason to keep that height (churches, `t`, `k`, `am` still are).
8. **Props** (src/props.js): add the zone to `ZONE_DIST` (how built-up, for car density), `ZONE_CARS`, `ZONE_SQ`, `CAFE_OUT` (share of cafes with chairs outside). Block 12f puts a produce stall on the pavement in front of every mapped greengrocer in a `town` zone.
9. **Check.** Before, after, photo at each viewpoint; the HUD name; Palermo centre, Via Liberta, Mondello and Brancaccio identical (pixel diff); frame time, draw calls and triangles before and after on the phone profile; route-check for legs nearby; no console errors.

## General and Villabate only

| Piece | General (reuse as is) | Villabate only |
| --- | --- | --- |
| `ZONES.villabate` fields | the field set, `town: true`, `front`, the ground-floor tables | the palette, the storey mix, the style weights |
| `SEEDS_LL`, `TOWNS_LL` | the mechanism | six seeds, one town entry |
| buildings.js | `old` machinery for `Z.town` zones, `TOWN_GROUND`, the zone palette instead of `OLD_PAL` | nothing |
| districts.js `zoneAt` | the street-name rules stay out of town zones | nothing |
| `applyDistrictHeights` | named unmeasured buildings take district storeys in town zones | nothing |
| src/danger-hud.js | `townAt` fallback for the neighbourhood name | the table entry |
| src/props.js | `ZONE_*` entries, block 12f (stalls at greengrocers) | the entries |
| src/lmc-towns.js | the file and `TOWN_LANDMARKS` | all three models (Sant'Agata, San Giuseppe, the Palchetto) |

## Not done (Villabate), for the next pass

- The pavements: the game paves every street with pale grid slabs and 2 to 3 m of kerb band; in Villabate they are narrow grey concrete kerbs. That is the streets layer (src/streets.js), not the district.
- Stone pines in the square on Via Terranova, the green-fenced noise barrier on the ring road, wires across the streets, planters at the bars, balconies glazed per flat, satellite dishes as geometry.
- A floating slab of balcony hangs over the street at Via Leonardo Sciascia and the south-east blocks (the same slab was there before this work): a `pwBalc` run on a building whose height is off.
- The east end of the town is outside the baked box (the baked box ends at x 8210); Corso Vittorio Emanuele towards Bagheria is not in the world.
- Facade of the Chiesa Madre: from the type, not from a photo.

# Monreale, Isola delle Femmine, Bellolampo (second pass)

Same recipe, three changes to it that Villabate taught: look at what the towns are made of first (building style, how wide the lanes really are), fix the missing buildings at the source, and do the landmark that matters.

## What was wrong

- **The buildings were not there.** OpenStreetMap has about 190 buildings in the 700 m round Monreale's Duomo (the CTR has about 2,000), and the Comune di Palermo survey stops at the city boundary. The game drew the old town as bare hill and its streets as 8 m roads with wide pavement bands. Fix at the source: `tools/ctr_buildings.py` (docs/sources/ctr-sicilia.md) takes the Regione Siciliana CTR layer 35 for the three towns; 1,960 buildings in Monreale, 449 in Isola delle Femmine and 47 in Bellolampo (the village was already mapped there) were added, 63 tiles rebaked, source and generated commits apart. Wall to wall on Monreale's baked residential streets is now 7.0 m (median, 3.6 to 30 m, class width 6 m); the asphalt is clipped by the buildings, so nothing else had to change.
- **Style by town.** Monreale (Mapillary, March 2019: 44 viewpoints spread over the town and 57 photos within 170 m of the Duomo): the old town on its ridge is solid blocks of 3 to 5 storey ochre, sand and pink palazzi with iron balconies and dark ashlar fronts on lanes of 5 to 7 m paved in setts (zone `monrealeOld`); round it and down the hill (Via Kennedy, Via della Repubblica, Via Zeta) it is 4 to 6 storey cream and white blocks with balconies in rows and shops below (zone `monreale`, 78 % post-war styles, not palazzo fronts). Isola delle Femmine (October 2019, one drive along the through road, 42 photos looked at): 2 to 4 storey yellow, salmon, pink and cream houses with shutters and iron balconies, rows of terraced houses (OSM `building=terrace`, which `applyDistrictHeights` used to leave at a generic 11 to 21 m: new zone flag `rows`), a 10 to 12 m road with a white kerb and a wall. Bellolampo (March 2019, one drive, 20 photos looked at): a scattered hill village of 1 to 3 storey houses behind stone walls, hedges, cypresses and guard rails.
- **Names in the HUD.** `townAt` now comes before the ISTAT neighbourhood grid, which only knows Palermo's own quarters (Bellolampo showed Borgo Nuovo, its landfill road Cruillas). Monreale, Isola delle Femmine and Bellolampo (reach 1,500 m, so the landfill track reads Bellolampo too).

## The Duomo di Monreale (src/lmc-towns.js)

Before: the OSM footprint extruded to a generic 22 m with small windows (a brick wall with holes). Now a model on the same footprint (88 by 43 m, about 1,200 triangles). **Seen in photos** (Mapillary, March 2019, from the north side): the golden tufa wall in three registers (an arcade at the foot, blind arches over it, tall pointed windows under the eaves), the square clock tower at the north-west corner with its crenellated top and bell, the low tiled roof. **Not seen in any photo, drawn from the type of a Norman basilica and the size Wikipedia gives (about 102 m by 40 m):** the west front between the towers (porch of three arches, the gable, the central window), the south tower, the three apses of the east end, the south side. All heights (eave 22 m, towers 36.5 and 33 m) are estimates from the photos, not measurements. The monastery and cloister beside it are the CTR blocks of generic buildings.

## Numbers (desktop 1280x720 / phone 844x390, headless Chrome, 11:00; the frame is capped at 16.7 ms there, so triangles and draw calls are what to read)

| place | before (origin/main) triangles / calls | after |
| --- | --- | --- |
| city centre (the ceiling) | 596k / 265 desktop, 682k / 299 phone | 596k / 263 desktop, 681k / 295 phone |
| Monreale, old town | 725k / 346, phone 793k / 379 | 454k / 217, phone 419k / 210 |
| Monreale, Duomo square | 310k / 267, phone 340k / 273 | 636k / 374, phone 689k / 394 |
| Monreale, Via Roma | 508k / 262, phone 662k / 303 | 398k / 187, phone 566k / 229 |
| Monreale, belt | 649k / 378, phone 715k / 408 | 479k / 276, phone 620k / 331 |
| Isola delle Femmine | 675k / 338, phone 675k / 374 | 469k / 223, phone 475k / 264 |
| Bellolampo | 616k / 289, phone 656k / 313 | 614k / 291, phone 654k / 318 |

The bare hills and their terrain triangles were more expensive than the buildings that replace them; the one place above the city centre is the Duomo square on the phone (689k against 681k), where the view spans the whole old town.

## Not done

- Pavements (the pale grid slabs, 2 to 3 m wide) and the sett paving of the old lanes: the streets layer.
- Landmarks other than the Duomo: Monreale's other churches (Sant'Antonio, the Collegio di Maria, Santissima Trinita), Isola delle Femmine's Maria SS. delle Grazie, the Torre di Dentro and the harbour, Bellolampo has none. They stand as generic buildings of their footprint.
- The Duomo's piazza (large grey slabs, palms, iron lamps, a bust on a column, a green hedge) is not drawn; the west front, the south tower and the apses are from the type (above).
- Isola delle Femmine: no photo of its side streets exists in Mapillary, so its look inside the grid is judged from the through road. Roof terraces, wires, satellite dishes, laundry.
- Hillside villas above Monreale (mo10, mo34): the CTR has the buildings, but they stand in the `rural` zone's 1 to 3 storey mix with few terraces.

# Belmonte Mezzagno, Capaci and the hill borgate (third pass)

The outskirts survey (docs/faithfulness/survey/zone-south-east.md item 8 and zs06, zone-west.md item 7, zone-north-west.md item 6) found Belmonte Mezzagno's centre to be a wide paved plaza where the photo has a street of balconied houses, and the village houses of the west and north-west to be plain boxes. Re-shot on current main with 21 photos in Belmonte Mezzagno (one drive, March 2019), 10 in Capaci (one drive, October 2019), 13 in Baida, Boccadifalco, Molara and Aquino (March 2019) and the survey's own viewpoints.

## What was wrong

- **Belmonte Mezzagno and Capaci were nearly empty.** OSM has 152 buildings within reach of Belmonte Mezzagno and 131 of Capaci; the CTR has about 850 and 1,450 in their boxes. The game drew bare hills with roads and parked cars on them; the plaza look at zs06 came mostly from the empty town round the square. Fix at the source, as for Monreale: `tools/ctr_buildings.py` takes the two towns too (624 and 564 buildings added) and 44 tiles are rebaked. Both are towns of their own (zones `belmonte` and `capaci`, the HUD names them), seeded at their OSM place nodes. The south half of Belmonte Mezzagno and the west end of Capaci are outside the baked map.
- **The square swallowed the road.** Piazza Giuseppe Garibaldi is one OSM pedestrian area of about 3,000 m2 laid over the junction of Via La Rocca and Corso Martiri di Via Fani; the photo has asphalt with zebra crossings and a strip with planters. The street layers pave an OSM pedestrian area over the carriageway, so the junction was slabs with a crowd on them. General rule in `tools/tiles.py` (`plazas_off_roads`): beyond the Comune's survey, the carriageway of every drivable road is cut out of an OSM square, in the square's area record, in the paving and in the carriageway layer. 61 polygons outside Palermo change, about 4,700 m2: mostly Belmonte Mezzagno and Capaci, a little in Villabate, Monreale, Isola delle Femmine and San Martino delle Scale. Inside the Comune's survey nothing changes.
- **Village houses had no faces.** The houses of Baida, Boccadifalco and Partanna are in the Comune's survey with lidar heights, so their massing is right, but they took the generic `periph` (or `tn`) zone: beige plaster, small windows, no balconies, no shutters, one slab per outline. New zone `borgata` (`town: true`, so the old-town facade machinery: houses cut along the street wall, shutters, surrounds, balconies in runs, the zone's palette), seeded at the OSM place nodes of Baida, Boccadifalco and Partanna. Molara and Aquino are left out: their photos are country lanes, and the 3 km `rural` seed there leaves a village seed almost no ground.
- **Balcony habit by zone.** `habH` on a zone replaces the balcony habit of plain houses (full, piano nobile only, mixed, none) in `oldHouses`; Belmonte Mezzagno and the borgate have a balcony on most upper floors in the photos.

## Side effects

- Zones: 778 buildings `periph` to `borgata` round Baida, 526 round Boccadifalco (35 of them `rural`), 520 `periph` and 534 `tn` round Partanna (Partanna's centre lay in the Tommaso Natale villa zone), 720 to `belmonte`, 553 to `capaci` (all were `periph` or `rural` by default). Everything else keeps its zone.
- Squares given back to the road outside the two towns: Piazza Sac. Vittorio Salmeri in Villabate (about 200 m2), bits of small squares in Monreale, Isola delle Femmine and San Martino delle Scale (under 90 m2 each).

## Numbers (headless Chrome, 11:00, chase camera at each viewpoint, median of 30 frames; triangles / draw calls)

| place | phone 844x390 before | after | desktop 1280x720 before | after |
| --- | --- | --- | --- | --- |
| Quattro Canti (reference) | 642k / 247 | 641k / 249 | 603k / 238 | 603k / 235 |
| Belmonte, Piazza Garibaldi (zs06) | 815k / 411 | 543k / 304 | 671k / 366 | 467k / 286 |
| Belmonte, long streets (bm09, bm13) | 533k / 291, 607k / 289 | 511k / 214, 494k / 201 | 531k / 284, 571k / 269 | 503k / 206, 485k / 191 |
| Belmonte, east edge (bm10, bm14) | 520k / 274, 560k / 275 | 573k / 227, 598k / 217 | 531k / 275, 569k / 274 | 587k / 229, 585k / 209 |
| Capaci, corso (cp03, cp06) | 734k / 336, 866k / 411 | 698k / 266, 664k / 249 | 727k / 324, 843k / 395 | 683k / 262, 654k / 247 |
| Boccadifalco (vc03, zw24) | 444k / 259, 784k / 347 | 444k / 258, 787k / 345 | 418k / 249, 736k / 322 | 415k / 249, 740k / 321 |
| Baida (vb02) | 813k / 460 | 816k / 456 | 795k / 444 | 802k / 447 |
| Partanna (nw36) | 468k / 203 | 475k / 199 | 461k / 195 | 459k / 192 |

As in the second pass the bare hills cost more than the houses that replace them. zw24 and vb02 were above the centre's figure before this work and still are (the view down the valley over the city); the borgata faces add about 3k.

## Not done

- Boccadifalco: the `periph` seed of the west outskirts stands in the village itself, so about half the houses round zw24 keep `periph`; the borgata faces show more in Baida, round vc03 and in Partanna than at zw24. Colour and balconies are still paler and fewer than in the photos.
- Belmonte Mezzagno beyond the map's south edge (z 7817), and Capaci west of x -11058.
- No landmark model: the Chiesa Madre of Belmonte Mezzagno and the churches of Capaci stand as generic church blocks of their footprint.
- Capaci's square at nw03: the CTR block stands where the photo shows the square with parked cars (the photo position may be off; not settled).
- Molara, Aquino, Villaggio Santa Rosalia and the other small borgate keep `periph` or `rural`. Sferracavallo's west end (nw17, nw18) falls to `rural` because the `sferra` seeds lie east of the village's OSM node; not changed here.
- Wires, satellite dishes, laundry, roof terraces; the stone setts and kerbs of the old lanes.
