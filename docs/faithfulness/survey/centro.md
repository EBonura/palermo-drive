# Survey: Centro storico

Reviewer notes from side-by-side comparison of in-game street-level shots (1.6 m eye height, time 11:00, headless Chrome) against the real city. `conf` says how a finding was checked: `sv` = compared with Google Street View at the same spot (viewed only, nothing copied), `mem` = from knowledge of the real place, please verify, `game` = defect visible in the game alone. Screenshots live outside the repo under /private/tmp/claude-501/survey/shots/<id>.png (not published).

Terrain-over-road counts come from a ray cast in the running game: up to 70 road centreline samples within 115 m of the viewpoint, first hit from above is either street_asphalt (fine) or a terrain mesh (the road is buried). Depths under 0.15 m are z-fight noise.

## Findings

1. **[med] [ground/decals]** (`ce19, ce11, ce17`, conf game) Tan terrain-tint patches lie across stone streets and pavements in the old town: ce19 (Via Sant Agostino / Capo) shows a sand-coloured polygon with a straight edge crossing the carriageway and pavement, ce11 (Corso Vittorio Emanuele at Porta Nuova) a tan rectangle on the asphalt next to a pothole cluster. They are terrain meshes showing through gaps in the street layers. Real: continuous basalt/limestone paving and asphalt.

2. **[med] [roads]** (`ce21, ce23, ce24, ce12, ce04, ce20`, conf game) Potholes and puddle decals on old-town streets: Via Cavour (ce21), Via Marina area (ce23, ce24) show 5 to 8 black hexagons and blue puddles in 6 m. Even Piazza Marina and the Cala are better kept in reality. Reduce density in the centro and make pits irregular.

3. **[med] [terrain hides road]** (`pt23, pt30, pt14, po12, ce35, ce09, ce17, ce05, ce06`, conf game) Even in the lidar centro the terrain mesh covers the road in places: Via Antonio Pacinotti 2 samples with 2.72 m of ground above the asphalt (38.1133,13.36703), Piazza Santa Teresa / Kalsa 4 samples up to 1.77 m, Piazza Tredici Vittime 10 samples (1.11 m), Via Francesco Crispi @85% 15 samples (1.11 m), Via Armando Diaz 0.35 m, Via Albergheria 0.37 m, Via Maqueda north 0.47 m, Piazza Verdi 0.26 m. In the screenshots this shows as grass or sand patches on the carriageway edge. Candidates: street polygons not cutting the terrain where the street layer is draped with a different height source than the terrain grid.

4. **[med] [vegetation]** (`ce12`, conf mem) Piazza Indipendenza (38.1104,13.3515): the square in front of Palazzo dei Normanni is a lime lawn with a handful of spruce cones; the real piazza has a stone-paved pedestrian area and a garden with tall palms, magnolias and ficus, with the long stone facade of the palace behind. Spruce cones are out of place anywhere in the old town.

5. **[low] [facade style]** (`ce04, ce05, ce06, ce07, ce08, ce10, ce13, ce14, ce15, ce16, ce18, ce22, ce25, ce26, ce27`, conf game) The old-town facades are the strongest part of the game: shuttered ground floors with painted fascias, wrought balconies, ashlar churches and palaces (Pretoria, Cattedrale shapes). Remaining weak points: the same black roller-shutter texture on every ground floor; identical red/white awning strip; ashlar texture on tall palace walls reads as large LEGO-like bricks (ce08, ce19 left).

6. **[low] [missing road]** (`ce11, ce33`, conf game) Corso Vittorio Emanuele at Porta Nuova (ce11) and Via Maqueda / Via Cavour (ce33): 8 and 5 centreline samples have no street mesh under them (zero asphalt, paving or raised hit). Likely junction polygons or pedestrian streets where the paving layer is clipped; the screenshots show a ragged gap.

7. **[low] [viewpoint note]** (`ce01, ce02, ce03`, conf game) The three Quattro Canti viewpoints snap to the same alley-like gap (-7.5, 3.7 m) and produce the same frame, a 4 m wide canyon of plain ashlar walls. An aerial at 70 m confirms the four concave baroque facades exist and look right; street level at the very centre of the octagon needs a dedicated camera spot (spot=1).

## Viewpoint table

| id | place | road | lat, lon, heading | buried samples (max depth m) | no road mesh | screenshot |
|---|---|---|---|---|---|---|
| ce01 | Quattro Canti, Via Maqueda north | Cortile Madonna della Lettera | 38.11569, 13.36117, 334 | 1 (0.19) | 0 | /private/tmp/claude-501/survey/shots/ce01.png |
| ce02 | Quattro Canti, Corso Vittorio Emanuele west | Cortile Madonna della Lettera | 38.11569, 13.36117, 334 | 1 (0.19) | 0 | /private/tmp/claude-501/survey/shots/ce02.png |
| ce03 | Quattro Canti, Corso Vittorio Emanuele east | Cortile Madonna della Lettera | 38.11569, 13.36117, 154 | 1 (0.19) | 0 | /private/tmp/claude-501/survey/shots/ce03.png |
| ce04 | Via Maqueda south of Quattro Canti | Via Maqueda | 38.1137, 13.36275, 153 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/ce04.png |
| ce05 | Via Maqueda north toward Teatro Massimo | Via Maqueda | 38.11824, 13.35981, 333 | 3 (0.47) | 1 | /private/tmp/claude-501/survey/shots/ce05.png |
| ce06 | Piazza Verdi, Teatro Massimo front | Piazza Giuseppe Verdi | 38.12058, 13.35803, 153 | 4 (0.26) | 0 | /private/tmp/claude-501/survey/shots/ce06.png |
| ce07 | Via Bara all Olivella | Via Bara All'Olivella | 38.121, 13.3605, 75 | 6 (0.22) | 0 | /private/tmp/claude-501/survey/shots/ce07.png |
| ce08 | Piazza Pretoria | Salita Santa Caterina | 38.11571, 13.36238, 168 | 1 (0.08) | 0 | /private/tmp/claude-501/survey/shots/ce08.png |
| ce09 | Piazza Bellini / Martorana | Vicolo San Giuseppe | 38.11532, 13.36074, 149 | 4 (0.27) | 0 | /private/tmp/claude-501/survey/shots/ce09.png |
| ce10 | Corso Vittorio Emanuele at Cattedrale | Via Simone di Bologna | 38.11429, 13.35678, 328 | 4 (0.22) | 0 | /private/tmp/claude-501/survey/shots/ce10.png |
| ce11 | Corso Vittorio Emanuele at Porta Nuova | Cortile Cannata | 38.11052, 13.35448, 53 | 0 (0) | 8 | /private/tmp/claude-501/survey/shots/ce11.png |
| ce12 | Piazza Indipendenza, Palazzo dei Normanni | Piazza Indipendenza | 38.11042, 13.35202, 358 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/ce12.png |
| ce13 | Corso Re Ruggero | Corso Re Ruggero | 38.10898, 13.35396, 140 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/ce13.png |
| ce14 | Corso Calatafimi start | Corso Pisani | 38.1074, 13.34802, 226 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/ce14.png |
| ce15 | Via Guglielmo il Buono | Corso Alberto Amedeo | 38.11384, 13.35239, 172 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/ce15.png |
| ce16 | Via Porta di Castro | Via Porta di Castro | 38.11129, 13.3571, 247 | 2 (0.1) | 0 | /private/tmp/claude-501/survey/shots/ce16.png |
| ce17 | Via Albergheria / Ballaro | Via Albergheria | 38.11037, 13.35902, 62 | 2 (0.37) | 0 | /private/tmp/claude-501/survey/shots/ce17.png |
| ce18 | Ballaro market area | Via Scarparelli | 38.11262, 13.35969, 93 | 1 (0.03) | 0 | /private/tmp/claude-501/survey/shots/ce18.png |
| ce19 | Capo market, Via Sant Agostino | Via Sant'Agostino | 38.1178, 13.35724, 72 | 4 (0.2) | 0 | /private/tmp/claude-501/survey/shots/ce19.png |
| ce20 | Vucciria, Piazza Caracciolo | Discesa San Domenico | 38.11857, 13.36327, 134 | 1 (0.13) | 0 | /private/tmp/claude-501/survey/shots/ce20.png |
| ce21 | Via Roma, centro | Via Roma | 38.11696, 13.36338, 339 | 1 (0.05) | 0 | /private/tmp/claude-501/survey/shots/ce21.png |
| ce22 | Via Cavour | Via Camillo Benso Conte di Cavour | 38.12189, 13.3605, 71 | 1 (0.17) | 0 | /private/tmp/claude-501/survey/shots/ce22.png |
| ce23 | Piazza Marina | Piazza Marina | 38.11819, 13.36868, 242 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/ce23.png |
| ce24 | Via Alloro, Kalsa | Via Alloro | 38.11609, 13.36941, 237 | 4 (0.1) | 0 | /private/tmp/claude-501/survey/shots/ce24.png |
| ce25 | Via Vittorio Emanuele at Porta Felice | Via della Cala | 38.11978, 13.37018, 243 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/ce25.png |
| ce26 | Piazza Giulio Cesare, Stazione Centrale | (unnamed) | 38.11006, 13.36614, 330 | 2 (0.06) | 0 | /private/tmp/claude-501/survey/shots/ce26.png |
| ce27 | Via Maqueda / Via Roma near Stazione | Via Maqueda | 38.11152, 13.36415, 333 | 8 (0.13) | 1 | /private/tmp/claude-501/survey/shots/ce27.png |
| ce28 | Corso Vittorio Emanuele, Piazza della Vittoria | Corso Vittorio Emanuele | 38.11227, 13.35301, 63 | 0 (0) | 1 | /private/tmp/claude-501/survey/shots/ce28.png |
| ce29 | Via Mariano Stabile | Via Mariano Stabile | 38.12334, 13.35867, 63 | 2 (0.04) | 0 | /private/tmp/claude-501/survey/shots/ce29.png |
| ce30 | Via Emerico Amari | (unnamed) | 38.11938, 13.37128, 270 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/ce30.png |
| ce31 | Via Principe di Belmonte (pedestrian) | Via Principe di Belmonte | 38.12484, 13.35958, 243 | 3 (0.21) | 0 | /private/tmp/claude-501/survey/shots/ce31.png |
| ce32 | Via Torquato Tasso | Via Francesco Crispi | 38.1264, 13.36294, 155 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/ce32.png |
| ce33 | Via Maqueda at Via Cavour, north end | Via Generale Magliocco | 38.12158, 13.35665, 244 | 1 (0.1) | 5 | /private/tmp/claude-501/survey/shots/ce33.png |
| ce34 | Via Abramo Lincoln | Via Abramo Lincoln | 38.11308, 13.37172, 59 | 2 (0.15) | 0 | /private/tmp/claude-501/survey/shots/ce34.png |
| ce35 | Via Armando Diaz | Via Mura della Pace | 38.11274, 13.36891, 155 | 3 (0.35) | 0 | /private/tmp/claude-501/survey/shots/ce35.png |
| ce36 | Via Antonello da Messina, Kalsa | Via Santa Teresa | 38.11559, 13.37254, 64 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/ce36.png |
| ce37 | Via Venti Settembre | Via Vittorio Emanuele | 38.11845, 13.36827, 243 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/ce37.png |
| ce38 | Via Colonna Rotta | Via Colonna Rotta | 38.11292, 13.34895, 124 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/ce38.png |
| ce39 | Via Danisinni | Via Danisinni | 38.11191, 13.34742, 278 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/ce39.png |
| ce40 | Via Paolo Borsellino | Via Francesco Potenzano | 38.11238, 13.34965, 31 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/ce40.png |
