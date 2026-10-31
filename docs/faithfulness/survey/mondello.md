# Survey: Mondello, Valdesi, Sferracavallo, Tommaso Natale, ZEN

Reviewer notes from side-by-side comparison of in-game street-level shots (1.6 m eye height, time 11:00, headless Chrome) against the real city. `conf` says how a finding was checked: `sv` = compared with Google Street View at the same spot (viewed only, nothing copied), `mem` = from knowledge of the real place, please verify, `game` = defect visible in the game alone. Screenshots live outside the repo under /private/tmp/claude-501/survey/shots/<id>.png (not published).

Terrain-over-road counts come from a ray cast in the running game: up to 70 road centreline samples within 115 m of the viewpoint, first hit from above is either street_asphalt (fine) or a terrain mesh (the road is buried). Depths under 0.15 m are z-fight noise.

## Findings

1. **[high] [pavements]** (`mo03, mo07, mo11, mo12, mo13, mo14, mo15, mo16, mo19, mo23, mo25, mo33, mo34, mo35, mo36, mo38, mo40`, conf game) Huge pale-grey paved slabs (the raised/paving street layer) flank almost every road in Mondello, Valdesi, Sferracavallo, Tommaso Natale and ZEN, often 30 to 60 m wide with nothing on them (mo13, mo15, mo16, mo36). Real: private plots behind garden walls, hedges, parking bays, dry scrub or narrow 2 m pavements. The raised layer is clearly being generated from parcels or landuse polygons, not from sidewalks. Cap raised/paving polygons by width (a sidewalk is under 4 m) and turn the rest into ground cover (dry grass, gravel, scrub) with walls.

2. **[high] [terrain hides road]** (`mo25`, conf game) Via Pietro Calandra, Sferracavallo (38.19371,13.27863): the road-bench shaping fails. 12 of 70 centreline samples are under terrain, up to 2.72 m, the asphalt ends in a ragged sliver, a puddle decal sticks out over the edge, and a sandy-coloured terrain tongue crosses the carriageway. Real: flat street between whitewashed fishermen houses.

3. **[high] [terrain hides road]** (`mo31`, conf game) Via Spina Santa (38.19536,13.29645): the road is a thin shelf cut into a bare pale slope, no verge, no guard rail, terrain wall on the left reaches above the eye line. Real road here is a normal 2-lane road with walls and olive/agave plantings. The slope colour is bare beige with no scrub.

4. **[high] [walls/gardens]** (`mo05, mo01, mo02, mo04, mo07, mo09`, conf sv) No garden walls, hedges, railings or villa gates anywhere along Viale Regina Elena, Via Principe di Scalea, Viale Galatea or Via Piano di Gallo. Real (Street View at 38.19972,13.32831, 38.20437,13.32516): continuous 1.5 to 2.5 m plastered or stone garden walls with oleander and bougainvillea hedges, iron gates, Liberty-style villas set back 5 to 10 m, parked Fiat Pandas along the kerb. Game: villas stand directly on bare paving with the door on the pavement.

5. **[med] [facade style]** (`mo24, mo33, mo34, mo36, mo38`, conf mem) ZEN and Tommaso Natale blocks are warm sand brown with a black window grid and tiny red/blue/white squares (bunting texture read as windows). Real ZEN 2 insulae are grey-white concrete with plaster patches, deep arcaded ground floors and continuous balcony galleries; Tommaso Natale mixes white/ochre plaster 3 to 5 storey blocks with garages at street level. The black glazed grid is too dark and uniform.

6. **[med] [pavements]** (`mo15, mo19, mo28, mo30`, conf mem) Mid-road transitions: asphalt sits on a darker sand-coloured band 3 to 6 m wide on each side (mo15, mo28), that is a terrain tint under the shaping bench. Reads as a dirt road shoulder that the real Via Castelforte, Viale delle Tre Grazie and Via Rosario Nicoletti do not have (they have kerbs and pavements).

7. **[med] [road layout]** (`mo02, mo05, mo01`, conf sv) Viale Regina Elena / SS113 at Mondello: real road is one wide carriageway (about 10 m) with a yellow edge line on the kerb side and a pale sandy verge next to the beach, kerbside parking on the villa side. Game shows 2 narrow lanes plus a 15 m paved esplanade on the sea side. Seafront side should be sand, a low wall and a narrow sidewalk, not a plaza.

8. **[med] [road layout]** (`mo33, mo34, mo35`, conf mem) Via Lanza di Scalea (38.17635,13.31035) and the ZEN avenues are drawn as 2 lanes with a tree-planted pavement. The real Lanza di Scalea is a dual-carriageway arterial (two lanes each way with a central reservation) near the ZEN, and Viale Sandro Pertini is wide with a median. Check OSM lanes and median tags, they are likely missing and the road is rendered from the minimum width.

9. **[med] [roads]** (`mo11, mo17, mo33, mo36, mo38, mo29, mo40`, conf game) Pothole, crack and patch decals are far too dense and regular (mo11 has 8 black pits in 10 m, mo33 and mo36 a conveyor belt of identical hexagonal holes). Mondello and Valdesi streets are in normal Italian condition: a few patches. Cap pit density to roughly one per 40 m and vary the shape; the black octagon reads as a manhole, not a pothole.

10. **[med] [vegetation]** (`mo37, mo36, mo35`, conf mem) ZEN fringe: big flat fields of dead straw ground with tall dark-green spruce cones (mo37) in a row. Real ZEN has lines of Aleppo pines and eucalyptus planted between the insulae, ground is bare dirt, gravel and waste. Spruce cones are wrong species for the whole Mondello/ZEN area.

11. **[low] [facade style]** (`mo41`, conf mem) Via Mater Dolorosa: Mater Dolorosa area reads right in massing and colour, but bunting flags are repeated on every facade (mo16, mo19, mo23, mo40, mo41). Reads as a festival; real streets have bunting only at feast times.

12. **[low] [sea/coast]** (`mo01, mo02, mo03, mo06`, conf mem) Mondello bay: sand colour and water are close. Missing the Mondello pier (Charleston lido on stilts, Art Nouveau, white/cream), beach cabins in rows, and the Capo Gallo headland silhouette is a little too tall and steep. Worth checking from the sea side aerial (ae03).

13. **[low] [street furniture]** (`mo05, mo09, mo20, mo26, mo32`, conf mem) Street lights are 12 to 14 m single-arm posts spaced irregularly; real Mondello uses 5 to 7 m pole lamps or lamps on facade brackets. Missing: bus shelters with route boards (one in mo32 only), kerb bollards in grey are good (mo01 to mo07).

14. **[low] [terrain hides road]** (`mo23, mo24, mo27, mo29, mo12, mo01, mo04`, conf game) Small bench seams (0.1 to 0.4 m of terrain above asphalt on 3 to 6 samples) where the road meets shaped ground: Via Sferracavallo, Via Rosario Nicoletti, Via Tommaso Natale, Viale Regina Elena side streets. Shows as a jagged edge between road and a darker sand-coloured band (mo23, mo27, mo28).

15. **[low] [terrain hides road]** (`mo10, mo11, mo12, mo14, mo16`, conf mem) Monte Gallo and Monte Pellegrino foot (Via Tolomea, Viale Principessa Iolanda): slopes are good, but the road runs straight up the slope with white paving on the slope side (mo11, mo14) and no retaining wall. Real streets here have 2 to 4 m retaining walls of stone block, with villas stepped above them.

16. **[low] [vegetation]** (`mo06, mo08, mo21, mo22, mo27`, conf mem) Lawn is bright lime green and perfectly uniform (mo06, mo08, mo22, mo27); Mondello in summer is dry ochre with palms, oleander and ficus. Palms are tall and acceptable, but there are no oleander hedges or ficus rows.

## Viewpoint table

| id | place | road | lat, lon, heading | buried samples (max depth m) | no road mesh | screenshot |
|---|---|---|---|---|---|---|
| mo01 | Viale Regina Elena @15% | Viale Regina Elena | 38.20437, 13.32516, 352 | 3 (0.26) | 0 | /private/tmp/claude-501/survey/shots/mo01.png |
| mo02 | Viale Regina Elena @50% | Viale Regina Elena | 38.19972, 13.32831, 318 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo02.png |
| mo03 | Viale Regina Elena @85% | Viale Regina Elena | 38.19637, 13.33392, 95 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo03.png |
| mo04 | Via Principe di Scalea @25% | Via Principe di Scalea | 38.2031, 13.32471, 333 | 3 (0.26) | 0 | /private/tmp/claude-501/survey/shots/mo04.png |
| mo05 | Via Principe di Scalea @75% | Via Principe di Scalea | 38.19857, 13.32832, 138 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo05.png |
| mo06 | Mondello beach front | Via Glauco | 38.2013, 13.32614, 65 | 2 (0.19) | 0 | /private/tmp/claude-501/survey/shots/mo06.png |
| mo07 | Viale Galatea @50% | Viale Galatea | 38.20018, 13.32204, 57 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo07.png |
| mo08 | Via Mondello @50% | Via Mondello | 38.20514, 13.32297, 205 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo08.png |
| mo09 | Via Piano di Gallo @50% | Via Piano di Gallo | 38.21006, 13.32906, 338 | 2 (0.25) | 0 | /private/tmp/claude-501/survey/shots/mo09.png |
| mo10 | Via Tolomea @30% | Via Tolomea | 38.2066, 13.31649, 254 | 2 (0.19) | 0 | /private/tmp/claude-501/survey/shots/mo10.png |
| mo11 | Via Tolomea @70% | Via Tolomea | 38.20703, 13.31893, 260 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo11.png |
| mo12 | Viale Venere @50% | Viale Venere | 38.1895, 13.32729, 80 | 5 (0.33) | 0 | /private/tmp/claude-501/survey/shots/mo12.png |
| mo13 | Viale delle Tre Grazie @50% | Viale delle Tre Grazie | 38.18456, 13.32956, 329 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo13.png |
| mo14 | Viale Principessa Iolanda @50% | Viale Principessa Iolanda | 38.19333, 13.3344, 175 | 1 (0.13) | 0 | /private/tmp/claude-501/survey/shots/mo14.png |
| mo15 | Via Giovanni Castellucci @50% | Via Giovanni Castellucci | 38.18819, 13.33072, 179 | 2 (0.14) | 0 | /private/tmp/claude-501/survey/shots/mo15.png |
| mo16 | Via Saline @50% | Via Saline | 38.19706, 13.32455, 285 | 1 (0.03) | 0 | /private/tmp/claude-501/survey/shots/mo16.png |
| mo17 | Via Partanna Mondello @25% | Via Partanna Mondello | 38.18903, 13.29519, 100 | 1 (0) | 0 | /private/tmp/claude-501/survey/shots/mo17.png |
| mo18 | Via Partanna Mondello @75% | Via Partanna Mondello | 38.19499, 13.30573, 58 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo18.png |
| mo19 | Via Castelforte @50% | Via Castelforte | 38.18146, 13.32501, 170 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo19.png |
| mo20 | Viale dell'Olimpo @15% | Viale dell'Olimpo | 38.1889, 13.3036, 90 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo20.png |
| mo21 | Viale dell'Olimpo @50% | Viale dell'Olimpo | 38.18904, 13.31139, 270 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo21.png |
| mo22 | Viale dell'Olimpo @85% | Viale dell'Olimpo | 38.18902, 13.31839, 270 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo22.png |
| mo23 | Via Sferracavallo @30% | Via Sferracavallo | 38.1962, 13.27901, 124 | 5 (0.15) | 0 | /private/tmp/claude-501/survey/shots/mo23.png |
| mo24 | Via Sferracavallo @80% | Via Sferracavallo | 38.19275, 13.28339, 325 | 3 (0.21) | 0 | /private/tmp/claude-501/survey/shots/mo24.png |
| mo25 | Via Pietro Calandra @50% | Via Pietro Calandra | 38.19371, 13.27863, 132 | 12 (2.72) | 0 | /private/tmp/claude-501/survey/shots/mo25.png |
| mo26 | Via Rosario Nicoletti @20% | Via Rosario Nicoletti | 38.19417, 13.2846, 303 | 1 (0.01) | 0 | /private/tmp/claude-501/survey/shots/mo26.png |
| mo27 | Via Rosario Nicoletti @50% | Via Rosario Nicoletti | 38.19139, 13.2901, 120 | 4 (0.18) | 0 | /private/tmp/claude-501/survey/shots/mo27.png |
| mo28 | Via Rosario Nicoletti @80% | Via Rosario Nicoletti | 38.18923, 13.2948, 120 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo28.png |
| mo29 | Via Tommaso Natale @30% | Via Tommaso Natale | 38.18154, 13.294, 331 | 6 (0.38) | 0 | /private/tmp/claude-501/survey/shots/mo29.png |
| mo30 | Via Tommaso Natale @70% | Via Tommaso Natale | 38.17833, 13.29651, 322 | 1 (0.15) | 0 | /private/tmp/claude-501/survey/shots/mo30.png |
| mo31 | Via Spina Santa @50% | Via Spina Santa | 38.19536, 13.29645, 342 | 2 (0.4) | 0 | /private/tmp/claude-501/survey/shots/mo31.png |
| mo32 | Via Lanza di Scalea @12% | Via Giuseppe Lanza di Scalea | 38.18532, 13.30211, 147 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo32.png |
| mo33 | Via Lanza di Scalea @50% | Via Giuseppe Lanza di Scalea | 38.17635, 13.31035, 328 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo33.png |
| mo34 | Via Lanza di Scalea @88% | Via Giuseppe Lanza di Scalea | 38.16894, 13.31541, 328 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo34.png |
| mo35 | ZEN Viale Sandro Pertini @50% | Viale Sandro Pertini | 38.17868, 13.32201, 132 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo35.png |
| mo36 | ZEN Via Patti @50% | Via Patti | 38.17318, 13.31708, 328 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo36.png |
| mo37 | ZEN Via Trapani Pescia @50% | Via Trapani Pescia | 38.1752, 13.32323, 306 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo37.png |
| mo38 | Via San Lorenzo @30% | Via San Lorenzo | 38.16905, 13.31191, 288 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo38.png |
| mo39 | Via San Lorenzo @70% | Via San Lorenzo | 38.16201, 13.3242, 314 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo39.png |
| mo40 | Viale della Resurrezione @50% | Viale della Resurrezione | 38.16852, 13.32201, 231 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo40.png |
| mo41 | Via Mater Dolorosa @50% | Via Mater Dolorosa | 38.17418, 13.33177, 65 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/mo41.png |
