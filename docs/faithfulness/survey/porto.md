# Survey: Port, Foro Italico, Cala, Kalsa

Reviewer notes from side-by-side comparison of in-game street-level shots (1.6 m eye height, time 11:00, headless Chrome) against the real city. `conf` says how a finding was checked: `sv` = compared with Google Street View at the same spot (viewed only, nothing copied), `mem` = from knowledge of the real place, please verify, `game` = defect visible in the game alone. Screenshots live outside the repo under /private/tmp/claude-501/survey/shots/<id>.png (not published).

Terrain-over-road counts come from a ray cast in the running game: up to 70 road centreline samples within 115 m of the viewpoint, first hit from above is either street_asphalt (fine) or a terrain mesh (the road is buried). Depths under 0.15 m are z-fight noise.

## Findings

1. **[high] [pavements]** (`pt01, pt02, pt03, pt04, pt05`, conf game) Foro Italico Umberto I (38.1163,13.3747 and along): 2-lane road flanked by 6 to 10 m wide tan dirt bands, lime-green lawn with spruce cones and fat deciduous trees, no sea wall, no palm avenue. Real Foro Italico is a long seaside esplanade: a double row of tall palms and ficus, a continuous low sea wall with a stone balustrade, pavement and benches next to the road, and the Villa Giulia / Palazzina Cinese gardens behind. Skid marks (pt04, pt05) are drawn across lanes at the zebra crossings.

2. **[med] [pavements]** (`pt06, pt07, pt08, pt09, pt10, pt11, pt12, pt13`, conf game) Port and Cala sides (Via della Cala, Via Imperatore Federico, Via Rosario Livatino): wide raised paving with a bollard row but no quay edge, no bollards at the water, no bitts or chains,. The Cala itself (ae22) looks right from the air: marina, jetty, green Foro Italico, but the quay-level details are absent.

3. **[med] [terrain hides road]** (`pt14, pt23, pt27, pt30, pt10, pt11, pt15`, conf game) Buried samples: Piazza Santa Teresa / Kalsa 4 (1.77 m), Via Antonio Pacinotti 2 (2.72 m), Piazza Tredici Vittime 10 (1.11 m), Via Gaetano Lodato 9 (0.86 m), Via Imperatore Federico 3 (0.26 m), Via Emerico Amari 4 (0.26 m).

4. **[med] [vegetation]** (`pt01, pt02, pt03, pt04, pt05, pt06`, conf game) Trees: fat low-poly deciduous balls and spruce cones. Palermo waterfront uses Washingtonia and Phoenix palms, ficus magnolia (huge, dark, buttressed roots at Villa Garibaldi / Piazza Marina) and plane trees; spruce should not appear at the seafront.

5. **[low] [facade style]** (`pt16, pt17, pt18, pt19, pt20, pt21, pt22, pt24, pt25, pt26, pt28, pt29, pt31, pt32, pt33`, conf game) Kalsa and Stazione Marittima lanes: the 3 to 5 storey palaces and shutters are good. Not re-reviewed with Street View; see centro.md for the shared facade comments.

## Viewpoint table

| id | place | road | lat, lon, heading | buried samples (max depth m) | no road mesh | screenshot |
|---|---|---|---|---|---|---|
| pt01 | Foro Italico @10% | Foro Italico Umberto I | 38.11918, 13.37205, 330 | 1 (0.02) | 0 | /private/tmp/claude-501/survey/shots/pt01.png |
| pt02 | Foro Italico @30% | Foro Italico Umberto I | 38.11749, 13.37313, 144 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pt02.png |
| pt03 | Foro Italico @50% | Foro Italico Umberto I | 38.11623, 13.3746, 131 | 1 (0.02) | 1 | /private/tmp/claude-501/survey/shots/pt03.png |
| pt04 | Foro Italico @70% | Foro Italico Umberto I | 38.11509, 13.37622, 146 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pt04.png |
| pt05 | Foro Italico @90% | Foro Italico Umberto I | 38.11367, 13.37729, 150 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pt05.png |
| pt06 | Via della Cala @20% | Via della Cala | 38.12027, 13.36658, 349 | 1 (0.03) | 0 | /private/tmp/claude-501/survey/shots/pt06.png |
| pt07 | Via della Cala @50% | Via della Cala | 38.11904, 13.36866, 231 | 2 (0.13) | 0 | /private/tmp/claude-501/survey/shots/pt07.png |
| pt08 | Via della Cala @80% | Via della Cala | 38.1198, 13.37022, 63 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pt08.png |
| pt09 | Porto, Via Francesco Crispi waterfront | Via Filippo Patti | 38.12438, 13.36827, 358 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pt09.png |
| pt10 | Via Imperatore Federico @30% | Via Imperatore Federico | 38.14575, 13.34894, 247 | 3 (0.26) | 0 | /private/tmp/claude-501/survey/shots/pt10.png |
| pt11 | Via Imperatore Federico @70% | Via Imperatore Federico | 38.14658, 13.35145, 247 | 1 (0.29) | 0 | /private/tmp/claude-501/survey/shots/pt11.png |
| pt12 | Domenico Costantino @50% | Via Domenico Costantino | 38.13167, 13.34541, 249 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pt12.png |
| pt13 | Via Edmondo De Amicis @50% | Via Edmondo De Amicis | 38.13926, 13.34787, 334 | 1 (0.06) | 0 | /private/tmp/claude-501/survey/shots/pt13.png |
| pt14 | Piazza Tredici Vittime | Piazza Tredici Vittime | 38.12294, 13.36437, 20 | 10 (1.11) | 0 | /private/tmp/claude-501/survey/shots/pt14.png |
| pt15 | Via Emerico Amari to the sea | Via Gaspare Bivona | 38.12153, 13.36625, 153 | 4 (0.26) | 0 | /private/tmp/claude-501/survey/shots/pt15.png |
| pt16 | Villa Giulia, Foro Italico | Via Nicolò Cervello | 38.11475, 13.37395, 150 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pt16.png |
| pt17 | Via Lincoln at Orto Botanico | Via Gaspare Mignosi | 38.10987, 13.37071, 59 | 1 (0.02) | 3 | /private/tmp/claude-501/survey/shots/pt17.png |
| pt18 | Santa Maria dello Spasimo, Kalsa | Via Carlo Rao | 38.11278, 13.37036, 325 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pt18.png |
| pt19 | Porta Felice and Cassaro end | (unnamed) | 38.11888, 13.37155, 150 | 1 (0.02) | 0 | /private/tmp/claude-501/survey/shots/pt19.png |
| pt20 | Stazione Marittima | Molo Piave | 38.12848, 13.3657, 81 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pt20.png |
| pt21 | Molo Trapezoidale approach | Via Filippo Patti | 38.12485, 13.36821, 316 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pt21.png |
| pt22 | Cantieri Navali / Ucciardone | Molo Piave | 38.12865, 13.36712, 81 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pt22.png |
| pt23 | Piazza Santa Teresa / Kalsa | Via Savona | 38.11599, 13.37263, 241 | 4 (1.77) | 0 | /private/tmp/claude-501/survey/shots/pt23.png |
| pt24 | Via Giuseppe Giusti | Via Francesco Crispi | 38.12444, 13.36418, 154 | 3 (0.21) | 0 | /private/tmp/claude-501/survey/shots/pt24.png |
| pt25 | Porto Via Emerico Amari south | (unnamed) | 38.11938, 13.37128, 270 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pt25.png |
| pt26 | Corso Tukory | Corso Tukory | 38.10881, 13.3593, 76 | 2 (0.14) | 0 | /private/tmp/claude-501/survey/shots/pt26.png |
| pt27 | Via Gaetano Lodato | Via Gaetano Lodato | 38.10523, 13.35844, 137 | 9 (0.86) | 0 | /private/tmp/claude-501/survey/shots/pt27.png |
| pt28 | Via del Vespro, Policlinico | Via del Vespro | 38.10592, 13.36255, 349 | 1 (0.01) | 0 | /private/tmp/claude-501/survey/shots/pt28.png |
| pt29 | Via Filippo Corazza | Via Filippo Corazza | 38.1059, 13.3643, 153 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pt29.png |
| pt30 | Via Antonio Pacinotti | Via Giuseppe Garibaldi | 38.1133, 13.36703, 156 | 1 (2.72) | 2 | /private/tmp/claude-501/survey/shots/pt30.png |
| pt31 | Via Gaspare Palermo | Via Gaspare Palermo | 38.10599, 13.3651, 61 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pt31.png |
| pt32 | Via Salamone Marino | Via Salamone Marino | 38.1075, 13.3597, 59 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pt32.png |
| pt33 | Via Tiro a Segno | Via Tiro a Segno | 38.1099, 13.37561, 31 | 2 (0.24) | 0 | /private/tmp/claude-501/survey/shots/pt33.png |
