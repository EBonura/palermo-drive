# Survey: Aerials and cross-cutting problems

Reviewer notes from side-by-side comparison of in-game street-level shots (1.6 m eye height, time 11:00, headless Chrome) against the real city. `conf` says how a finding was checked: `sv` = compared with Google Street View at the same spot (viewed only, nothing copied), `mem` = from knowledge of the real place, please verify, `game` = defect visible in the game alone. Screenshots live outside the repo under /private/tmp/claude-501/survey/shots/<id>.png (not published).

Terrain-over-road counts come from a ray cast in the running game: up to 70 road centreline samples within 115 m of the viewpoint, first hit from above is either street_asphalt (fine) or a terrain mesh (the road is buried). Depths under 0.15 m are z-fight noise.

## Findings

1. **[high] [missing buildings]** (`ae18, ae19, ae17, ae14, ae15, ae12, ae20, ae09, su02, su26, su28, su29, su44`, conf sv) Building density outside the centro is far too low. Footprint area as a share of ground (3 by 3 tiles around the spot, from world/tiles): centro 50 %, Noce 31 %, Politeama 34 %, Libertà 26 %, Oreto 23 %, Brancaccio 22 %, Uditore 20 %, Cruillas 18 %, Mondello 17 %, ZEN 15 %, Romagnolo 16 %, Borgo Nuovo 14.5 %, Villagrazia 13 %, Tommaso Natale 12.6 %. Satellite view of Brancaccio (38.10,13.39) shows an unbroken grid of 4 to 6 storey blocks with narrow gaps; in the game (ae18) it is a tan field with islands of buildings. Street View of Via Oreto shows continuous street walls where the game has a 70 m empty plain. OSM building coverage in the outskirts is incomplete or merged. Consider filling from another reusable footprint source (check licence compatibility: Overture Maps buildings, Microsoft ML Building Footprints) for tiles under about 30 % coverage, and extruding lot-width default blocks along streets that have none.

2. **[high] [pavements]** (`ae09, ae10, ae11, ae12, ae13, ae14, ae15, ae17, ae18, ae19, ae20, ae21, ae25, ae07, ae05`, conf game) White halos. From the air every building cluster outside the old centre sits inside a pale grey-white blob 15 to 40 m thick, the blobs merge along streets, and the ground between them is tan dry terrain. This is the raised/paving street layer. At street level it is the huge empty plazas next to roads in Mondello, ZEN, Zisa, Boccadifalco, Brancaccio, Villagrazia, Addaura and Acquasanta. Likely cause: raised polygons are generated from a buffered hull around each building or from landuse polygons instead of from sidewalks. This single defect affects more than half the viewpoints and wipes out the real texture of these quarters (walled gardens, kerbs, tree rows, parking).

3. **[high] [pavements]** (`mo15, mo19, mo28, po14, po15, po18, zi04, zi09, zi15, zi16, zi17, zi19, zi20, zi21, su02, su07, su08, su09, su10, su19, su26, su28, su29, su44, su46, pt01, pt03, pt04, pe22, pe18, lm19, lm20, lm21, lm22, lm23`, conf game) Tan sand bands and terrain-tint patches replace kerbs and verges next to the asphalt (3 to 15 m on each side) on roughly one in five viewpoints, and become 20 to 70 m wide plains along the ring road, Via Oreto and the south coast. They come from the road shaping bench plus fallow/brownfield landuse tint. Real roads have kerb, gutter, painted edge lines or a pavement; verges where present are narrow and planted.

4. **[high] [road layout]** (`su07, su08, su09, su10, zi15, zi17, zi18, zi19, zi21, lm19, lm20, lm21, lm22, lm23, lm24`, conf sv) Dual carriageways and motorways are drawn as one ordinary 2-lane road with a single dashed centre line: Viale Regione Siciliana (both ends), the A29 link road, Via Castellana. Real ones have 2 to 3 lanes per direction, a median (concrete barrier or planted strip with oleander and lamp posts), hard shoulder or kerb, edge lines, gantries and signs. This is the main road type a driving game uses at speed.

5. **[high] [terrain hides road]** (`mo11, mo25, mo31, pe02, pe04, pe06, pe08, zi24, zi29, po12, pt30, pt23, lm16, su01, su02, su29`, conf game) Buried roads: at least 22 street-level viewpoints show a road partly under terrain, worst 6.6 m (Via Pietro Bonanno, 38.16016,13.34982) and 5.94 m (Via Pietro Bonanno, 38.15217,13.36476), 2.72 m (Via Pietro Bonanno / Via Antonio Pacinotti), 2.28 m (Via Poggio Ridente), 2.06 m (Bonanno hairpin crown). The ray cast also finds smaller seams (0.3 to 1.5 m) in the flat centro. The same road samples can read clean when probed after neighbouring tiles are already loaded, so the result depends on tile load order (see buried-roads.md for the dense scan and the cold-load experiment).

6. **[high] [vegetation]** (`pe01, pe02, pe03, pe04, pe05, pe10, pe11, pe17, pe32, pe33, pe34, zi24, zi37, zi38, zi39, mo37, lm01, lm02, lm03, pt01, pt03, pt04, ce12, su16, su27`, conf sv) One conifer model (a sharp dark-green spruce cone, 10 to 25 m, trunk with no branches) stands for every tree in the hills, parks and streets, on lime-green lawn. Palermo has Aleppo pine and stone pine (flat or irregular umbrella crowns), holm oak, carob, olive, cypress, ficus magnolia, jacaranda, palms (Washingtonia, Phoenix), eucalyptus and plane trees in avenues, agave and prickly pear on slopes. The lawn colour is lime where the real ground is dry straw/ochre from June to October. Add 3 to 4 more tree meshes, tint ground dry, and reserve cone-shaped conifers for none.

7. **[med] [roads]** (`mo11, mo17, mo33, mo36, mo38, zi12, zi13, zi31, zi33, ce21, ce23, ce24, su21, su22, su38, su45, su28, lm01, lm04, lm09, pt04, pt05`, conf game) Road decals: black hexagonal pothole pits (some 1.5 m wide), blue puddle hexagons that look like water-filled holes, long black skid pairs across lanes at zebras and junctions, and dark rectangles with black outlines (inspection patches). Density is 5 to 10 per frame on residential roads, spacing looks conveyor-belt regular. Real streets have occasional patches and cracks; the Via Bonanno surface (Street View) is smooth. Cap density, vary shape and size, make puddles rare.

8. **[med] [terrain/ground]** (`ae05, ae06, ae07, ae10, ae11, ae12, ae20, ae25, pe08, pe19`, conf game) Steep slopes (Pellegrino north and east faces, Monte Billiemi, Monte Cuccio, Grifone) show vertical streaks (texture stretched down the fall line on near-vertical triangles), and the Pellegrino cliffs read as dark green with grey stripes instead of pale limestone with horizontal strata. pe08 shows sawtooth spikes of terrain (5 to 6 m tall, 3 m wide) at the Via Bonanno hairpin: noise from the lidar-less far grid.

9. **[med] [terrain/ground]** (`ae04, ae05, ae06, ae07, ae08`, conf mem) Monte Pellegrino is almost uniformly dark forest green from the air (ae04). Real: pale grey limestone with bare scree and scrub on the north and east faces and the summit plateau; pine woods mainly in the south-west flank and along the Via Bonanno climb, with grey-white rock bands. Needs a land-cover or slope-and-aspect rule: bare rock above about 35 degrees and on the summit.

10. **[low] [coastline/sea]** (`ae25, ae26, ae03, ae04`, conf game) Far terrain has hard straight clip lines: a vertical cut in the hills at the far left of ae25 (Bellolampo), a rectangular step in the coast at the far north of ae26, a horizontal tone band across the Mondello plain in ae03 (an LOD band where textured buildings change). Likely the manifest bbox or a LOD ring edge. Worth a smoothing blend.

11. **[low] [landmarks]** (`ae22, ae23, ae01, ae24, ae02, ae13, ae16`, conf game) Port, Cala, Foro Italico and the old town read very well from the air: marina piers, green Foro Italico, Villa Giulia, the cathedral and Teatro Massimo shapes, dense terracotta roofs. These areas can serve as the quality bar for the rest.

12. **[low] [landmarks]** (`ae08`, conf mem) Stadio Renzo Barbera is present and recognisable as a bowl with a green roof ring and the pitch (ae08), set in a green park with the Favorita orchard grid next to it. Roof colour and the floodlight ring should be checked against photos (the real roof is grey and white with pink seat blocks).

13. **[low] [terrain/ground]** (`ae05, ae07`, conf game) White triangular wedges stick out of the cliff tops (ae05 top-left and right edge): paving polygons draped over steep ground, seen as flat white sails.

## Viewpoint table

| id | place | road | lat, lon, heading | buried samples (max depth m) | no road mesh | screenshot |
|---|---|---|---|---|---|---|
| id | place | lat, lon, heading | screenshot |
|---|---|---|---|
| ae01 | Centro storico | 38.1157, 13.3613, 0 (altitude 400 m) | /private/tmp/claude-501/survey/shots/ae01.png |
| ae02 | Politeama and Liberta looking north | 38.133, 13.35, 0 (altitude 500 m) | /private/tmp/claude-501/survey/shots/ae02.png |
| ae03 | Mondello from the sea | 38.2, 13.325, 180 (altitude 350 m) | /private/tmp/claude-501/survey/shots/ae03.png |
| ae04 | Monte Pellegrino south face | 38.165, 13.36, 0 (altitude 900 m) | /private/tmp/claude-501/survey/shots/ae04.png |
| ae05 | Addaura and north Pellegrino from the sea | 38.193, 13.35, 180 (altitude 700 m) | /private/tmp/claude-501/survey/shots/ae05.png |
| ae06 | Acquasanta and Arenella from the east | 38.17, 13.372, 270 (altitude 500 m) | /private/tmp/claude-501/survey/shots/ae06.png |
| ae07 | Vergine Maria and Pellegrino east foot | 38.162, 13.37, 270 (altitude 500 m) | /private/tmp/claude-501/survey/shots/ae07.png |
| ae08 | Favorita and stadium | 38.156, 13.343, 0 (altitude 600 m) | /private/tmp/claude-501/survey/shots/ae08.png |
| ae09 | ZEN | 38.176, 13.316, 0 (altitude 400 m) | /private/tmp/claude-501/survey/shots/ae09.png |
| ae10 | Sferracavallo | 38.195, 13.283, 180 (altitude 350 m) | /private/tmp/claude-501/survey/shots/ae10.png |
| ae11 | Tommaso Natale | 38.185, 13.29, 0 (altitude 400 m) | /private/tmp/claude-501/survey/shots/ae11.png |
| ae12 | Boccadifalco and Baida looking west | 38.115, 13.3, 270 (altitude 500 m) | /private/tmp/claude-501/survey/shots/ae12.png |
| ae13 | Zisa and Cuba | 38.115, 13.34, 0 (altitude 400 m) | /private/tmp/claude-501/survey/shots/ae13.png |
| ae14 | Uditore and Borgo Nuovo | 38.13, 13.32, 0 (altitude 450 m) | /private/tmp/claude-501/survey/shots/ae14.png |
| ae15 | Cruillas | 38.143, 13.322, 0 (altitude 450 m) | /private/tmp/claude-501/survey/shots/ae15.png |
| ae16 | Oreto and Stazione looking south | 38.105, 13.36, 180 (altitude 450 m) | /private/tmp/claude-501/survey/shots/ae16.png |
| ae17 | Brancaccio | 38.1, 13.39, 180 (altitude 450 m) | /private/tmp/claude-501/survey/shots/ae17.png |
| ae18 | Corso dei Mille and Romagnolo | 38.09, 13.405, 270 (altitude 450 m) | /private/tmp/claude-501/survey/shots/ae18.png |
| ae19 | Bandita and Acqua dei Corsari | 38.095, 13.42, 270 (altitude 450 m) | /private/tmp/claude-501/survey/shots/ae19.png |
| ae20 | Ciaculli and Monte Grifone | 38.078, 13.405, 180 (altitude 600 m) | /private/tmp/claude-501/survey/shots/ae20.png |
| ae21 | Villagrazia | 38.087, 13.35, 0 (altitude 500 m) | /private/tmp/claude-501/survey/shots/ae21.png |
| ae22 | Port and Cala from the sea | 38.123, 13.369, 180 (altitude 350 m) | /private/tmp/claude-501/survey/shots/ae22.png |
| ae23 | Foro Italico | 38.116, 13.375, 270 (altitude 350 m) | /private/tmp/claude-501/survey/shots/ae23.png |
| ae24 | Notarbartolo | 38.138, 13.34, 0 (altitude 450 m) | /private/tmp/claude-501/survey/shots/ae24.png |
| ae25 | Bellolampo | 38.095, 13.28, 0 (altitude 600 m) | /private/tmp/claude-501/survey/shots/ae25.png |
| ae26 | Whole city from the sea | 38.15, 13.35, 180 (altitude 2200 m) | /private/tmp/claude-501/survey/shots/ae26.png |
