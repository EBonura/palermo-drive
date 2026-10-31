# Survey: Zisa, Noce, Uditore, Borgo Nuovo, Cruillas, Boccadifalco, Baida

Reviewer notes from side-by-side comparison of in-game street-level shots (1.6 m eye height, time 11:00, headless Chrome) against the real city. `conf` says how a finding was checked: `sv` = compared with Google Street View at the same spot (viewed only, nothing copied), `mem` = from knowledge of the real place, please verify, `game` = defect visible in the game alone. Screenshots live outside the repo under /private/tmp/claude-501/survey/shots/<id>.png (not published).

Terrain-over-road counts come from a ray cast in the running game: up to 70 road centreline samples within 115 m of the viewpoint, first hit from above is either street_asphalt (fine) or a terrain mesh (the road is buried). Depths under 0.15 m are z-fight noise.

## Findings

1. **[high] [missing road]** (`zi18`, conf sv) Viale Regione Siciliana Nord Ovest at 38.13036,13.33005 heading 6 (Uditore/Noce): the viewpoint is the carriageway centreline and there is no road. 17 of 70 centreline samples have no asphalt mesh under them and the camera stands on a flat tan dirt plain. Satellite view: this is a 3+3 lane dual carriageway with a planted median, slip roads and a junction with Via Ernesto Basile style ramps, houses on the east side and a fallow field on the west. OSM tags it primary w=11 as one line; the dual carriageway and its slip roads need real width (about 25 m for both carriageways plus median) and both carriageways must emit asphalt.

2. **[high] [pavements]** (`zi07, zi08, zi12, zi13, zi14, zi26, zi27, zi29, zi31, zi35`, conf game) Same oversize raised paving as elsewhere: Via Perpignano, Viale Leonardo da Vinci, Via Altarello side, Via Poggio Ridente (zi29: paving climbs the hill on both sides like a ski slope) and Via al Convento di Baida (zi35: white paving ramp up the slope beside a 3 storey shutter wall). Real street edges here are 1.5 to 3 m pavements next to building fronts, with retaining walls on slopes.

3. **[high] [road layout]** (`zi15, zi17, zi19, zi21`, conf mem) Viale Regione Siciliana (zi17, zi19) and Via Castellana (zi21) show 3 to 4 lane asphalt with wide tan dirt bands as the central reservation and hard shoulder (zi17: asphalt, then 6 m of dirt, then the other carriageway). Real Regione Siciliana has a concrete or guard-railed median, planted oleander, lamp posts in the median and a hard shoulder with white edge lines; in many sections service roads run parallel. Replace the dirt gap with a raised median strip (kerb, oleander row, lamp posts) and add edge lines.

4. **[high] [terrain hides road]** (`zi24`, conf game) Via San Martino @50% (38.1067,13.28284 heading 231): a pale terrain tongue with a hard polygon edge cuts across the foreground and half the carriageway, the road bench is a flat grey wedge above a green slope. Reads as an unfinished mesh seam. Real: a normal 2-lane mountain road with a retaining wall and pines on the slope.

5. **[high] [terrain hides road]** (`zi29`, conf game) Via Poggio Ridente @30% (38.10173,13.30565): 4 samples under terrain, up to 2.28 m near the climb; the road dips under the paving ramp. Also seen at Via al Convento di Baida (9 samples, 0.46 m) and Via Alla Falconara (4 samples, 0.5 m).

6. **[med] [landmarks]** (`zi10`, conf mem) Stadio Renzo Barbera is visible at left in zi10 as a white tribune with a green roof and teal stripes. Real stadium is a grey/white concrete bowl with a steel cantilever roof, pink-rosa seat sections and a visible ring of floodlight towers; the Palermo pink and black. Verify against the stadium section (lm01, lm02).

7. **[med] [pavements]** (`zi04, zi06, zi09, zi11, zi15, zi16, zi17, zi18, zi19, zi20, zi21`, conf game) Tan sand/dirt bands 3 to 8 m wide between the asphalt and the pavement or kerb (zi04, zi09, zi15, zi16, zi19, zi20, zi21). They are the terrain tint under the road shaping bench and they replace the kerb and gutter. Real Viale Michelangelo, Viale Leonardo da Vinci and Viale del Fante have kerbs and 2 to 3 m pavements directly on the asphalt edge, with tree pits.

8. **[med] [roads]** (`zi01, zi02, zi12, zi13, zi14, zi31, zi33`, conf game) Pothole and crack decals are far too dense (zi12, zi13, zi31, zi33 have 4 to 8 big black hexagons in view). Via Cruillas, Viale Leonardo da Vinci and Via Altarello are in normal condition. Also repeating dark rectangle patches (zi31, zi32) like drawn boxes.

9. **[med] [terrain/ground]** (`zi23, zi24, zi25, zi30, zi33`, conf game) Monte Billiemi / Baida foothills (Via San Martino, Via Poggio Ridente, Via Umberto Maddalena): slopes are pale beige with sparse dark spruces on the far slopes. Real slopes here are olive groves, almond and carob terraces with dry-stone walls, pale limestone cliffs further up, and scattered cypress. The white terraced villas on the ridge (zi23, left far) look like paving patches.

10. **[low] [facade style]** (`zi05, zi07, zi08, zi09`, conf game) Viale Leonardo da Vinci, Viale Michelangelo: 6 to 9 storey modern apartment blocks in beige with identical window grids. Colours are plausible; real blocks vary: white, grey, ochre, salmon with balconies in rhythm and ground floor shops with awnings. All these blocks have the same black roller-shutter ground floor.

11. **[low] [road layout]** (`zi01, zi02, zi03`, conf game) Via Cruillas @30/70 (zi01, zi02) reads right: narrow street, 4 storey buildings, shutters, a dumpster. Good. zi03 (Via Galileo Galilei): junction has traffic signals and zebra but no stop lines or lane arrows.

12. **[low] [road layout]** (`zi37, zi38, zi39, zi40, zi41`, conf game) Not reviewed in detail beyond the buried-road check; Via San Martino delle Scale, Via Bellavista, Via Dante and the Zisa castle surroundings show 0 to 9 buried samples (see table).

13. **[low] [terrain/ground]** (`zi28, zi32, zi36`, conf sv) Boccadifalco, Via Roccazzo / Via Belvedere / Via Luparello: very large open dry-grass plains with a road ribbon across them. Satellite (38.11948,13.30524): there is a big fallow field plus the Boccadifalco airfield runway and hangars at the east, so the openness is partly right, but the real area also has dense low-rise housing along these roads, tree-lined avenues and vineyards. Houses are absent along the road edge in zi28 and zi32.

## Viewpoint table

| id | place | road | lat, lon, heading | buried samples (max depth m) | no road mesh | screenshot |
|---|---|---|---|---|---|---|
| zi01 | Via Cruillas @30% | Via Cruillas | 38.14365, 13.31908, 299 | 0 (0) | 1 | /private/tmp/claude-501/survey/shots/zi01.png |
| zi02 | Via Cruillas @70% | Via Cruillas | 38.14194, 13.32473, 291 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi02.png |
| zi03 | Via Galileo Galilei @50% | Via Galileo Galilei | 38.1364, 13.33258, 163 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi03.png |
| zi04 | Via Uditore @50% | Via Uditore | 38.1306, 13.32506, 144 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi04.png |
| zi05 | Viale Leonardo da Vinci @20% | Viale Leonardo da Vinci | 38.12657, 13.30911, 88 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi05.png |
| zi06 | Viale Leonardo da Vinci @50% | Viale Leonardo da Vinci | 38.12693, 13.31788, 268 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi06.png |
| zi07 | Viale Leonardo da Vinci @80% | Viale Leonardo da Vinci | 38.12797, 13.32654, 253 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi07.png |
| zi08 | Viale Michelangelo @30% | Viale Michelangelo | 38.13453, 13.31248, 242 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi08.png |
| zi09 | Viale Michelangelo @70% | Viale Michelangelo | 38.13768, 13.32219, 74 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi09.png |
| zi10 | Viale del Fante @30% | Viale del Fante | 38.15318, 13.34029, 153 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi10.png |
| zi11 | Viale del Fante @70% | Viale del Fante | 38.14918, 13.34278, 336 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi11.png |
| zi12 | Via Perpignano @50% | Via Perpignano | 38.11942, 13.32825, 278 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi12.png |
| zi13 | Evangelista di Blasi @50% | Via Giovanni Evangelista di Blasi | 38.12307, 13.32241, 278 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi13.png |
| zi14 | Via Badia @50% | Via Badia | 38.13724, 13.31815, 330 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi14.png |
| zi15 | Viale Regione Siciliana Nord Ovest @10% | Viale Regione Siciliana Nord Ovest | 38.16341, 13.30859, 316 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi15.png |
| zi16 | Viale Regione Siciliana Nord Ovest @30% | Viale Regione Siciliana Nord Ovest | 38.15042, 13.32414, 136 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi16.png |
| zi17 | Viale Regione Siciliana Nord Ovest @50% | Viale Regione Siciliana Nord Ovest | 38.14161, 13.33147, 0 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi17.png |
| zi18 | Viale Regione Siciliana Nord Ovest @70% | Viale Regione Siciliana Nord Ovest | 38.13036, 13.33005, 6 | 0 (0) | 17 | /private/tmp/claude-501/survey/shots/zi18.png |
| zi19 | Viale Regione Siciliana Nord Ovest @90% | Viale Regione Siciliana Nord Ovest | 38.11965, 13.32863, 181 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi19.png |
| zi20 | Via Castellana @30% | Via Castellana | 38.12553, 13.29306, 98 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi20.png |
| zi21 | Via Castellana @70% | Via Castellana | 38.12588, 13.30175, 251 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi21.png |
| zi22 | Via Alla Falconara @50% | Via Alla Falconara | 38.11476, 13.29453, 135 | 4 (0.5) | 0 | /private/tmp/claude-501/survey/shots/zi22.png |
| zi23 | Via San Martino @20% | Via San Martino Delle Scale | 38.09859, 13.27112, 210 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi23.png |
| zi24 | Via San Martino @50% | Via San Martino Delle Scale | 38.1067, 13.28284, 231 | 2 (0.31) | 0 | /private/tmp/claude-501/survey/shots/zi24.png |
| zi25 | Via San Martino @80% | Via San Martino | 38.10722, 13.29741, 290 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi25.png |
| zi26 | Via Altarello @50% | Via Altarello | 38.10991, 13.32378, 79 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi26.png |
| zi27 | Via Ruffo di Calabria @50% | Via Ruffo di Calabria | 38.11201, 13.29549, 157 | 1 (0.15) | 0 | /private/tmp/claude-501/survey/shots/zi27.png |
| zi28 | Via Roccazzo @50% | Via Roccazzo | 38.11948, 13.30524, 32 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi28.png |
| zi29 | Via Poggio Ridente @30% | Via Poggio Ridente | 38.10173, 13.30565, 336 | 4 (2.28) | 0 | /private/tmp/claude-501/survey/shots/zi29.png |
| zi30 | Via Poggio Ridente @70% | Via Poggio Ridente | 38.10283, 13.30849, 187 | 1 (0.04) | 0 | /private/tmp/claude-501/survey/shots/zi30.png |
| zi31 | Via Giuseppe Pitrè @50% | Via Giuseppe Pitrè | 38.11051, 13.32436, 264 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi31.png |
| zi32 | Via Belvedere @50% | Via Belvedere | 38.11731, 13.31794, 342 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi32.png |
| zi33 | Via Umberto Maddalena @50% | Via Umberto Maddalena | 38.10186, 13.31049, 2 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi33.png |
| zi34 | Via Baracca Francesco @50% | Via Baracca Francesco | 38.10932, 13.30218, 108 | 3 (0.12) | 0 | /private/tmp/claude-501/survey/shots/zi34.png |
| zi35 | Via Al Convento di Baida @50% | Via Al Convento di Baida | 38.11105, 13.30066, 306 | 9 (0.46) | 0 | /private/tmp/claude-501/survey/shots/zi35.png |
| zi36 | Via Luparello @50% | Via Luparello | 38.11261, 13.30063, 78 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi36.png |
| zi37 | Via San Martino Delle Scale @30% | Via San Martino Delle Scale | 38.09287, 13.26081, 223 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi37.png |
| zi38 | Via San Martino Delle Scale @70% | Via San Martino Delle Scale | 38.10489, 13.27222, 244 | 2 (0.21) | 0 | /private/tmp/claude-501/survey/shots/zi38.png |
| zi39 | Via Bellavista @50% | Via Bellavista | 38.11761, 13.28559, 248 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi39.png |
| zi40 | Via Dante @50% | Via Dante | 38.12292, 13.34733, 253 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/zi40.png |
| zi41 | Zisa castle surroundings | Piazza Zisa | 38.11645, 13.34123, 7 | 0 (0) | 2 | /private/tmp/claude-501/survey/shots/zi41.png |
