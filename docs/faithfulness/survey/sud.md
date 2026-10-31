# Survey: Oreto, Stazione, Corso dei Mille, Brancaccio, Romagnolo, Bandita, Ciaculli, Villagrazia

Reviewer notes from side-by-side comparison of in-game street-level shots (1.6 m eye height, time 11:00, headless Chrome) against the real city. `conf` says how a finding was checked: `sv` = compared with Google Street View at the same spot (viewed only, nothing copied), `mem` = from knowledge of the real place, please verify, `game` = defect visible in the game alone. Screenshots live outside the repo under /private/tmp/claude-501/survey/shots/<id>.png (not published).

Terrain-over-road counts come from a ray cast in the running game: up to 70 road centreline samples within 115 m of the viewpoint, first hit from above is either street_asphalt (fine) or a terrain mesh (the road is buried). Depths under 0.15 m are z-fight noise.

## Findings

1. **[high] [missing buildings]** (`su02, su01`, conf sv) Via Oreto @50% (38.09778,13.37306 heading 333): game shows a 70 m wide tan dirt plain on both sides of a 2-lane road with dumpsters and no building within 40 m. Street View (410 Via Oreto): a continuous street with 3 to 5 storey buildings and shop fronts on both sides, kerbside parking, a hedge strip and palms on the left, a billboard. Via Oreto also has buried carriageway: 8 and 10 of 70 samples under terrain (0.95 m at su01, 1.43 m at su02). Fix the ground tint (the tan is landuse that is not there) and add the building rows (check why OSM buildings are missing: tile bake or a landuse=railway/brownfield tint is painting over a built-up street).

2. **[high] [pavements]** (`su07, su08, su09, su10, su04, su02, su16, su19, su26, su28, su29, su44, su46`, conf sv) Large tan sand bands and plains replace kerbs, verges and tree rows along the south ring road, Corso dei Mille (su04), Via Oreto, Via Villagrazia (su16), Via Salvatore Corleone (su26), Romagnolo (su28, su29) and Via Messina Marine (su44, su46). This tint comes from fallow/brownfield landuse and the road bench. Street View at Via Salvatore Corleone (38.08945,13.40146) and SS113 (38.0935,13.43849): the road has painted edge lines, a narrow dirt verge, eucalyptus/plane tree rows, farmhouses and utility poles; on SS113 an overhanging tree canopy and a metal guardrail. No bare plain.

3. **[high] [pavements]** (`su13, su14, su15, su17, su18, su32, su33, su34, su36, su39, su40, su43`, conf game) Oversize pale paving (raised layer) fills the space between building fronts and the road, 20 to 40 m wide, with cars standing on it (su14, su15, su17, su18, su33, su34, su39, su40). Via Villagrazia, Via Ernesto Basile, Via Palmerino, Via Santa Maria di Gesù, Via Aloi: same defect as Mondello. Real pavements are 1.5 to 3 m.

4. **[high] [road layout]** (`su07, su08, su09, su10`, conf sv) Viale Regione Siciliana Sud Est (E90 ring road, 38.08708,13.34864): game has 2 narrow lanes with 8 to 15 m tan dirt bands each side and a far-off separate carriageway. Street View: two carriageways of 2 to 3 lanes with a continuous planted median, both flanked by rows of tall Aleppo or stone pines, white edge lines, kerbs, buildings behind a service lane. Add the median (kerb, shrubs), lane count and the pine rows; remove the dirt shoulder tint.

5. **[high] [terrain/ground]** (`su19, su20, su21, su22, su23, su24, su25, su35, su46`, conf mem) Monte Grifone / Falsomiele / Ciaculli / Portella di Palermo: slopes are plain dry-grass beige or lime with no terracing; Ciaculli is the mandarin and citrus district and has dense walled orchards with green canopies, dry-stone walls and farm buildings; Falsomiele and Villagrazia have rows of cypress and eucalyptus. None of that is drawn (su19, su21, su22, su35, su46). Needs an orchard land cover (OSM landuse=orchard exists in the bake) drawn as dense rounded tree rows.

6. **[med] [coastline/sea]** (`su42, su43, su44, su45, su46`, conf game) Via Messina Marine and the south coast: the shore and sea appear only at the far right (su42, su44); real SS113 runs 10 to 50 m from the shore with a mix of port yards, villas and open sandy lots. Hard to judge without aerial; see ae18 and ae19 for the aerials.

7. **[med] [ground/decals]** (`su06`, conf game) Corso dei Mille @85% (38.09059,13.41548): a flat rectangular tan terrain-tint tile floats on the asphalt right in front of the camera (hard straight edges, fully opaque), as if a terrain tile intersects the street mesh. Also su31 (Via Sperone): a jagged tan patch lies on the carriageway.

8. **[med] [roads]** (`su21, su22, su34, su38, su45, su11, su23, su28`, conf game) Big blue puddle decals (hexagons of mirror-blue water) in the middle of the carriageway at 11:00 in a dry scene (su21, su22, su38, su45, su28). They read as holes full of water, and are 3 m wide. Real streets are dry. Use them rarely and only after rain.

9. **[med] [terrain hides road]** (`su29`, conf game) Via Giovanni Di Stefano (38.08816,13.40618, heading 31): the carriageway rides over a terrain ridge, the horizon is a lump and the asphalt is only 5 m wide on a 30 m earth mound. 2 samples hidden (0.18 m), but the road shape reads as a causeway. Real: flat road, no bank.

10. **[med] [terrain hides road]** (`su30, su35, su37, su28, su42, su01, su02`, conf game) Buried road samples: Via Brancaccio 5 (0.42 m), Via Portella di Palermo 2 (0.52 m), Viale Giuseppe Di Vittorio 2 (0.36 m), Via Messina Marine @20% 3 (0.17 m), Via Oreto 8 and 10 (0.95, 1.43 m). See the dense scan in buried-roads.md for the full list.

11. **[med] [vegetation]** (`su11, su12, su18, su26, su27, su41`, conf sv) Roadside trees are sparse and isolated. Real arterials here (Via Pio La Torre, Via Lenin Mancuso, Viale Regione Siciliana) have rows of mature Aleppo pines and plane or ficus trees at 8 to 12 m spacing with big canopies (Street View E90 at 38.08708,13.34864). Row planting from OSM natural=tree_row is not used.

12. **[low] [facade style]** (`su05, su06, su20, su24, su25, su30, su31, su36`, conf game) Corso dei Mille, Via Ciaculli and Via Brancaccio massing and ground-floor shutters are close; the stucco colours (pink, ochre, terracotta, grey) are plausible. Some blocks are uniform 3-storey slabs of 80 to 120 m with one repeated bay pattern (su05, su30). Real long blocks vary by building (different heights and cornice lines every 15 to 25 m).

## Viewpoint table

| id | place | road | lat, lon, heading | buried samples (max depth m) | no road mesh | screenshot |
|---|---|---|---|---|---|---|
| su01 | Via Oreto @20% | Via Oreto | 38.10306, 13.36964, 333 | 8 (0.95) | 0 | /private/tmp/claude-501/survey/shots/su01.png |
| su02 | Via Oreto @50% | Via Oreto | 38.09778, 13.37306, 333 | 10 (1.43) | 0 | /private/tmp/claude-501/survey/shots/su02.png |
| su03 | Via Oreto @80% | Via Oreto | 38.0941, 13.37527, 153 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su03.png |
| su04 | Corso dei Mille @15% | Corso dei Mille | 38.10862, 13.3709, 324 | 3 (0.05) | 0 | /private/tmp/claude-501/survey/shots/su04.png |
| su05 | Corso dei Mille @50% | Corso dei Mille | 38.09952, 13.38715, 283 | 1 (0.12) | 0 | /private/tmp/claude-501/survey/shots/su05.png |
| su06 | Corso dei Mille @85% | Corso dei Mille | 38.09059, 13.41548, 290 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su06.png |
| su07 | Viale Regione Siciliana Sud Est @15% | Viale Regione Siciliana Sud Est | 38.09617, 13.33548, 132 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su07.png |
| su08 | Viale Regione Siciliana Sud Est @40% | Viale Regione Siciliana Sud Est | 38.08708, 13.34864, 119 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su08.png |
| su09 | Viale Regione Siciliana Sud Est @65% | Viale Regione Siciliana Sud Est | 38.08868, 13.36825, 79 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su09.png |
| su10 | Viale Regione Siciliana Sud Est @90% | Viale Regione Siciliana Sud Est | 38.08892, 13.3862, 109 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su10.png |
| su11 | Via Lenin Mancuso @50% | Via Lenin Mancuso | 38.09878, 13.32271, 140 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su11.png |
| su12 | Via Pio La Torre @50% | Via Pio La Torre | 38.11239, 13.33207, 211 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su12.png |
| su13 | Via Ernesto Basile @50% | Via Ernesto Basile | 38.09887, 13.34661, 22 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su13.png |
| su14 | Via Villagrazia @20% | Via Villagrazia | 38.08174, 13.33558, 36 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su14.png |
| su15 | Via Villagrazia @50% | Via Villagrazia | 38.08746, 13.35081, 39 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su15.png |
| su16 | Via Villagrazia @80% | Via Villagrazia | 38.0937, 13.36043, 213 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su16.png |
| su17 | Via Palmerino @50% | Via Palmerino | 38.09529, 13.32807, 56 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su17.png |
| su18 | Via Filippo Paruta @50% | Via Filippo Paruta | 38.09417, 13.31962, 160 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su18.png |
| su19 | Via Falsomiele @30% | Via Falsomiele | 38.07647, 13.34855, 131 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su19.png |
| su20 | Via Falsomiele @70% | Via Falsomiele | 38.07722, 13.36648, 250 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su20.png |
| su21 | Via Conte Federico @30% | Via Conte Federico | 38.08947, 13.39514, 307 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su21.png |
| su22 | Via Conte Federico @70% | Via Conte Federico | 38.07883, 13.40965, 126 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su22.png |
| su23 | Via Ciaculli @20% | Via Ciaculli | 38.08384, 13.39538, 138 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su23.png |
| su24 | Via Ciaculli @50% | Via Ciaculli | 38.07683, 13.40482, 116 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su24.png |
| su25 | Via Ciaculli @80% | Via Ciaculli | 38.07089, 13.4156, 135 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su25.png |
| su26 | Salvatore Corleone @50% | Via Salvatore Corleone | 38.08945, 13.40146, 111 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su26.png |
| su27 | Filippo Pecoraino @50% | Via Filippo Pecoraino | 38.09407, 13.4023, 129 | 1 (0.02) | 0 | /private/tmp/claude-501/survey/shots/su27.png |
| su28 | Viale Giuseppe Di Vittorio @50% | Viale Giuseppe Di Vittorio | 38.09603, 13.40635, 114 | 2 (0.36) | 0 | /private/tmp/claude-501/survey/shots/su28.png |
| su29 | Giovanni Di Stefano @50% | Via Giovanni Di Stefano | 38.08816, 13.40618, 31 | 2 (0.18) | 0 | /private/tmp/claude-501/survey/shots/su29.png |
| su30 | Via Brancaccio @50% | Via Brancaccio | 38.09979, 13.38092, 324 | 5 (0.42) | 0 | /private/tmp/claude-501/survey/shots/su30.png |
| su31 | Via Sperone @50% | Via Sperone | 38.0994, 13.39939, 100 | 2 (0.11) | 0 | /private/tmp/claude-501/survey/shots/su31.png |
| su32 | Viale Amedeo D'Aosta @50% | Viale Amedeo D'Aosta | 38.10282, 13.38586, 36 | 2 (0.02) | 0 | /private/tmp/claude-501/survey/shots/su32.png |
| su33 | Via Santa Maria di Gesù @50% | Via Santa Maria di Gesù | 38.0912, 13.37375, 334 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su33.png |
| su34 | Via Belmonte Chiavelli @50% | Via Belmonte Chiavelli | 38.08758, 13.37023, 193 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su34.png |
| su35 | Via Portella di Palermo @50% | Via Portella di Palermo | 38.05753, 13.38282, 321 | 2 (0.52) | 0 | /private/tmp/claude-501/survey/shots/su35.png |
| su36 | Via Aloi @50% | Via Aloi | 38.08029, 13.3541, 346 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su36.png |
| su37 | Via Altofonte @30% | Via Altofonte | 38.07034, 13.32747, 9 | 2 (0.05) | 0 | /private/tmp/claude-501/survey/shots/su37.png |
| su38 | Via Altofonte @70% | Via Altofonte | 38.08694, 13.32834, 226 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su38.png |
| su39 | Via Gustavo Roccella @50% | Via Gustavo Roccella | 38.09625, 13.34836, 223 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su39.png |
| su40 | Via Bandita @50% | Via Bandita | 38.09454, 13.41523, 25 | 1 (0.02) | 0 | /private/tmp/claude-501/survey/shots/su40.png |
| su41 | Via Papa Giovanni Paolo II @50% | Via Papa Giovanni Paolo II | 38.07744, 13.44869, 110 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su41.png |
| su42 | Via Messina Marine @20% | Via Messina Marine | 38.10374, 13.39232, 298 | 3 (0.17) | 0 | /private/tmp/claude-501/survey/shots/su42.png |
| su43 | Via Messina Marine @50% | Via Messina Marine | 38.09771, 13.41486, 277 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su43.png |
| su44 | Via Messina Marine @80% | Via Messina Marine | 38.0935, 13.43849, 285 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su44.png |
| su45 | Via Giulio Natta @50% | Via Giulio Natta | 38.08355, 13.44654, 267 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su45.png |
| su46 | Villagrazia hills @35% | Via Villagrazia | 38.08707, 13.34068, 96 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/su46.png |
