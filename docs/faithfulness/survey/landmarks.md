# Survey: Stadium, landmarks, main avenues

Reviewer notes from side-by-side comparison of in-game street-level shots (1.6 m eye height, time 11:00, headless Chrome) against the real city. `conf` says how a finding was checked: `sv` = compared with Google Street View at the same spot (viewed only, nothing copied), `mem` = from knowledge of the real place, please verify, `game` = defect visible in the game alone. Screenshots live outside the repo under /private/tmp/claude-501/survey/shots/<id>.png (not published).

Terrain-over-road counts come from a ray cast in the running game: up to 70 road centreline samples within 115 m of the viewpoint, first hit from above is either street_asphalt (fine) or a terrain mesh (the road is buried). Depths under 0.15 m are z-fight noise.

## Findings

1. **[high] [landmarks]** (`lm04, lm05`, conf game) Santuario di Santa Rosalia (38.1680,13.3518) and Castello Utveggio (38.1519,13.3555): from the road at each there is no sanctuary and no castle in view. lm04 shows only a pale-paved slope and a 4 storey block with bunting; lm05 shows a white paved slope with pedestrians standing on it and no castle. The real sanctuary is a cave church with a baroque facade on a paved terrace, bell tower and rock overhang at the end of the Via Bonanno climb; the Castello Utveggio is a distinctive round/arched 1930s building on the Pellegrino ridge visible from half the city. Check whether the landmark builder places them (ground height 415 m, 313 m), and drop the white slab on the hillside.

2. **[high] [pavements]** (`lm10, lm12, lm26, lm27`, conf game) Same wide paving problem around the Ippodromo (lm10), the Policlinico (lm12), Cimitero Rotoli / Via Messina Marine (lm26) and the Fiera (lm27). Roads are 6 m wide with a 20 to 40 m paved apron on each side and a few bollards. The Policlinico road (lm12) has a 120 m long slab block with 7 floors of identical windows and no entrance, no trees.

3. **[high] [road layout]** (`lm19, lm20, lm21, lm22, lm23, lm24`, conf game) Motorway and expressway (A29 Raccordo per Via Belgio lm19 to lm22, Viale Regione Siciliana NO ends lm23, lm24) draw as an ordinary 2-lane street: one dashed centre line, no hard shoulder, no guard rail, no concrete median barrier, no gantries or exit signs, lamp posts like a village road, tan dirt on both sides. OSM width is 14 m for the motorway, so it should carry 2 lanes per direction plus shoulder, a central barrier, solid edge lines and sound walls. These are the roads the player drives fastest on, so recognisability is high.

4. **[med] [landmarks]** (`lm01, lm02, lm03, pe32`, conf mem) Stadio Renzo Barbera (38.1528,13.3422): from Viale del Fante only a teal-striped tribune edge is visible; no cantilever roof, no pink/black seating, no floodlight towers; the surroundings are a mown lime lawn with tall spruce cones and skid-mark decals on the road. Real stadium sits among apartment blocks and a tree-lined plaza, Via del Fante at its front is a 3-lane avenue. Needs a proper stadium model and plaza.

5. **[med] [landmarks]** (`lm08, lm25, lm14`, conf mem) La Zisa (38.1168,13.3411) and Palazzina Cinese are only seen under a huge low-poly tree trunk, the lawn in front is lime green and flat, and the castle wall in view is a plain sandstone block texture; no arches, no pool, no garden. Reference the real Zisa: tall rectangular castle with a row of blind arches on the front, a fountain pool in front, palms.

6. **[med] [roads]** (`lm01, lm04, lm05, lm07, lm09`, conf game) Black skid-mark decals run 10 to 20 m across lanes at lm01, lm04, lm09 (long parallel tyre tracks across the carriageway at a junction). Real junctions have a few short marks at most. Also lm09 and lm07 show a dark rectangular patch (inspection hatch) with a thick black outline in the middle of the lane, which reads as a hole.

7. **[med] [terrain hides road]** (`lm16`, conf game) Villa Malfitano (38.1313,13.3553): 9 of 70 samples are under terrain, up to 1.46 m: the garden terrain sits above the street asphalt in front of the villa wall. In the real city the street is level with the pavement and the garden is walled.

8. **[med] [vegetation]** (`lm17, lm18, lm14`, conf game) Palazzo Florio and Hotel San Paolo views: trees are fat low-poly balls in neat grids (lm17 plaza); real plazas here use ficus magnolia and palms. The ground cover is paving, which is plausible for lm17.

9. **[low] [facade style]** (`lm06, lm07, lm09, lm11`, conf game) Via Marchese di Villabianca / Cuba / Notarbartolo-style blocks are well massed (6 to 9 storeys, balconies, shop fronts with awnings). Balcony railings and shutters look good. Ground floors are mostly closed roller shutters with a brown stripe fascia, repeating every 6 m.

10. **[low] [facade style]** (`lm29, lm28`, conf game) Via Marchese Ugo / Viale della Libertà north end and Politeama junction not reviewed in depth (see politeama.md).

11. **[low] [roads]** (`lm18`, conf game) Hotel San Paolo Palace area: large blue puddle decal and tan terrain tongue on the road. Low priority.

12. **[low] [terrain hides road]** (`lm27, lm13, lm15, lm28`, conf game) Fiera del Mediterraneo 9 samples (0.34 m), Palazzo di Giustizia 3 (0.11 m), Politeama junction 3 (0.09 m): small bench seams at the road edge.

## Viewpoint table

| id | place | road | lat, lon, heading | buried samples (max depth m) | no road mesh | screenshot |
|---|---|---|---|---|---|---|
| lm01 | Stadio Renzo Barbera, Viale del Fante | (unnamed) | 38.15229, 13.34098, 332 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/lm01.png |
| lm02 | Stadio Renzo Barbera, east side | Viale Ercole | 38.15379, 13.34613, 330 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/lm02.png |
| lm03 | Palazzina Cinese, Favorita | Via Duca degli Abruzzi | 38.16663, 13.32992, 330 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/lm03.png |
| lm04 | Santuario di Santa Rosalia | Via Monte Erta | 38.16834, 13.35127, 39 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/lm04.png |
| lm05 | Castello Utveggio approach | Via Padre Ennio Pintacuda | 38.15234, 13.35581, 9 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/lm05.png |
| lm06 | Cuba Sottana | Corso Calatafimi | 38.10795, 13.34237, 63 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/lm06.png |
| lm07 | Cuba Soprana, Corso Calatafimi | Via Francesco Scaduto | 38.13806, 13.34201, 345 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/lm07.png |
| lm08 | Castello della Zisa front | Piazza Zisa | 38.11645, 13.34123, 7 | 0 (0) | 2 | /private/tmp/claude-501/survey/shots/lm08.png |
| lm09 | Stazione Notarbartolo | Piazza Matteo Maria Boiardo | 38.13252, 13.34219, 342 | 0 (0) | 1 | /private/tmp/claude-501/survey/shots/lm09.png |
| lm10 | Ippodromo La Favorita Mondello | (unnamed) | 38.19115, 13.31114, 46 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/lm10.png |
| lm11 | Ospedale Civico | Via Luigi Campo | 38.10234, 13.35695, 310 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/lm11.png |
| lm12 | Policlinico Paolo Giaccone | Viale delle Scienze | 38.10157, 13.3462, 314 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/lm12.png |
| lm13 | Palazzo di Giustizia | Vicolo dell'Abbadia | 38.11795, 13.35373, 56 | 3 (0.11) | 0 | /private/tmp/claude-501/survey/shots/lm13.png |
| lm14 | Albergo delle Povere | Corso Pisani | 38.10961, 13.35045, 55 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/lm14.png |
| lm15 | Orto Botanico | Via Gaspare Mignosi | 38.10987, 13.37071, 59 | 1 (0.02) | 3 | /private/tmp/claude-501/survey/shots/lm15.png |
| lm16 | Villa Malfitano | Via Alfonso Borrelli | 38.13126, 13.35533, 62 | 9 (1.46) | 0 | /private/tmp/claude-501/survey/shots/lm16.png |
| lm17 | Palazzo Florio | Via Catania | 38.129, 13.35223, 63 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/lm17.png |
| lm18 | Hotel San Paolo Palace | Via Messina Marine | 38.10815, 13.38127, 316 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/lm18.png |
| lm19 | A29 Raccordo @10% | Raccordo per Via Belgio | 38.18692, 13.28633, 293 | 1 (0.04) | 6 | /private/tmp/claude-501/survey/shots/lm19.png |
| lm20 | A29 Raccordo @35% | Raccordo per Via Belgio | 38.17648, 13.29495, 152 | 1 (0.01) | 0 | /private/tmp/claude-501/survey/shots/lm20.png |
| lm21 | A29 Raccordo @60% | Raccordo per Via Belgio | 38.16605, 13.30491, 135 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/lm21.png |
| lm22 | A29 Raccordo @85% | Raccordo per Via Belgio | 38.15764, 13.31529, 138 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/lm22.png |
| lm23 | Circonvallazione ends @2% | Viale Regione Siciliana Nord Ovest | 38.16951, 13.30063, 146 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/lm23.png |
| lm24 | Circonvallazione ends @98% | Viale Regione Siciliana Nord Ovest | 38.11459, 13.32958, 354 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/lm24.png |
| lm25 | Torre Sperlinga | Via Francesco Scaduto | 38.13758, 13.34331, 76 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/lm25.png |
| lm26 | Cimitero Rotoli / Via Messina Marine | Via Filippo Pecoraino | 38.09485, 13.39993, 291 | 1 (0.02) | 0 | /private/tmp/claude-501/survey/shots/lm26.png |
| lm27 | Fiera del Mediterraneo | Via Angiò | 38.14115, 13.35391, 329 | 9 (0.34) | 0 | /private/tmp/claude-501/survey/shots/lm27.png |
| lm28 | Teatro Politeama, Via Libertà junction | Via Simone Corleo | 38.1295, 13.35351, 333 | 3 (0.09) | 0 | /private/tmp/claude-501/survey/shots/lm28.png |
| lm29 | Via Marchese Ugo / Libertà north end | Viale del Fante | 38.14786, 13.34354, 339 | 1 (0.01) | 0 | /private/tmp/claude-501/survey/shots/lm29.png |
