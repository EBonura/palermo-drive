# Survey: Politeama, Liberta, Notarbartolo, Strasburgo

Reviewer notes from side-by-side comparison of in-game street-level shots (1.6 m eye height, time 11:00, headless Chrome) against the real city. `conf` says how a finding was checked: `sv` = compared with Google Street View at the same spot (viewed only, nothing copied), `mem` = from knowledge of the real place, please verify, `game` = defect visible in the game alone. Screenshots live outside the repo under /private/tmp/claude-501/survey/shots/<id>.png (not published).

Terrain-over-road counts come from a ray cast in the running game: up to 70 road centreline samples within 115 m of the viewpoint, first hit from above is either street_asphalt (fine) or a terrain mesh (the road is buried). Depths under 0.15 m are z-fight noise.

## Findings

1. **[med] [landmarks]** (`po01, po02, po03, po04`, conf mem) Politeama (38.1281,13.3560): from Piazza Ruggero Settimo (po01, po02) the viewpoint looks at street fronts only; the Politeama theatre with its triumphal arch and bronze quadriga, and the semicircular colonnaded facade, are not in view at the snapped spot. Verify by looking at the theatre directly (lm28) since it is the second most recognisable landmark of the city.

2. **[med] [pavements]** (`po14, po15, po17, po18, po16, po13`, conf game) Same oversize paving as outside: Via Marchese di Villabianca, Via Croce Rossa and Via Montepellegrino have a 10 to 25 m flat plaza on each side of the 2-lane asphalt (po17 is almost a parade ground), and tan dirt bands next to the kerb (po14, po15, po18). Real streets here are walled front gardens and 2 to 3 m pavements.

3. **[med] [road layout]** (`po05, po06`, conf mem) Via della Libertà @22% and @40% (38.1331,13.3502): a 3-lane carriageway with hedge cubes and tree rows looks right in spirit. Real boulevard has a central avenue plus two service roads, separated by tree strips with palms and plane trees (planted 2 rows each side) and tram-like kerbs. Green hedge boxes are solid cubes with flat tops, not hedges.

4. **[med] [terrain hides road]** (`po12, po14, po18, po34, po07, po20`, conf game) Buried road samples: Via Francesco Crispi @85% (38.12344,13.36479) 15 samples up to 1.11 m; Via Marchese di Villabianca @70% 10 samples up to 0.77 m; Via Montepellegrino @30% (38.14081,13.35784) 7 samples up to 0.71 m (this road runs up to the foot of Pellegrino); Piazza Antonino Caponnetto 9 samples up to 0.79 m; Via della Libertà 7 (0.27 m); Via Sampolo 5 (0.27 m).

5. **[low] [facade style]** (`po25, po26, po27, po28, po29, po30, po31, po32, po33, po35, po36, po37`, conf game) Strasburgo / Cruillas fringe blocks: believable colours; some uniform ochre slabs of 100 m (see Viale Strasburgo). Not enough detail to flag more without a closer look.

6. **[low] [road layout]** (`po08, po09, po10, po11, po19, po21, po22, po23, po24`, conf game) Notarbartolo, Viale Lazio, Via Sciuti, Viale Croce Rossa: 2 to 3 lane streets with tall (6 to 10 storey) uniform blocks. Massing is believable for the area; windows are tiny and the same on every block. Via Notarbartolo (po23) has 4 samples without street mesh.

## Viewpoint table

| id | place | road | lat, lon, heading | buried samples (max depth m) | no road mesh | screenshot |
|---|---|---|---|---|---|---|
| po01 | Piazza Ruggero Settimo, Politeama | Via Isidoro Carini | 38.12821, 13.35627, 333 | 4 (0.29) | 0 | /private/tmp/claude-501/survey/shots/po01.png |
| po02 | Piazza Castelnuovo | Piazza Castelnuovo | 38.12396, 13.35505, 59 | 1 (0.01) | 4 | /private/tmp/claude-501/survey/shots/po02.png |
| po03 | Via Ruggero Settimo | Via Filippo Turati | 38.12557, 13.35676, 63 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po03.png |
| po04 | Via Francesco Crispi at Piazza Politeama | Via Giuseppina Turrisi Colonna | 38.12543, 13.34716, 65 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po04.png |
| po05 | Via della Liberta @6% | Via della Libertà | 38.14336, 13.34354, 152 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po05.png |
| po06 | Via della Liberta @22% | Via della Libertà | 38.13847, 13.34671, 153 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po06.png |
| po07 | Via della Liberta @40% | Via della Libertà | 38.13307, 13.3502, 153 | 7 (0.27) | 0 | /private/tmp/claude-501/survey/shots/po07.png |
| po08 | Via della Liberta @57% | Via della Libertà | 38.12949, 13.35273, 333 | 1 (0.03) | 0 | /private/tmp/claude-501/survey/shots/po08.png |
| po09 | Via della Liberta @76% | Via della Libertà | 38.12736, 13.35369, 153 | 1 (0.06) | 0 | /private/tmp/claude-501/survey/shots/po09.png |
| po10 | Via della Liberta @94% | Via della Libertà | 38.12577, 13.35493, 153 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po10.png |
| po11 | Francesco Crispi @15% | Via Francesco Crispi | 38.13105, 13.36049, 341 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po11.png |
| po12 | Francesco Crispi @85% | Via Francesco Crispi | 38.12344, 13.36479, 335 | 15 (1.11) | 0 | /private/tmp/claude-501/survey/shots/po12.png |
| po13 | Marchese di Villabianca @30% | Via Marchese di Villabianca | 38.14042, 13.34862, 333 | 1 (0.01) | 0 | /private/tmp/claude-501/survey/shots/po13.png |
| po14 | Marchese di Villabianca @70% | Via Marchese di Villabianca | 38.1375, 13.35023, 152 | 10 (0.77) | 0 | /private/tmp/claude-501/survey/shots/po14.png |
| po15 | Viale Croce Rossa @30% | Viale Croce Rossa | 38.15011, 13.33913, 153 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po15.png |
| po16 | Viale Croce Rossa @75% | Viale Croce Rossa | 38.148, 13.34035, 153 | 1 (0.01) | 0 | /private/tmp/claude-501/survey/shots/po16.png |
| po17 | Viale delle Alpi @50% | Viale delle Alpi | 38.14157, 13.33473, 143 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po17.png |
| po18 | Via Montepellegrino @30% | Via Montepellegrino | 38.14081, 13.35784, 172 | 7 (0.71) | 0 | /private/tmp/claude-501/survey/shots/po18.png |
| po19 | Via Montepellegrino @70% | Via Montepellegrino | 38.13802, 13.35845, 354 | 2 (0.14) | 0 | /private/tmp/claude-501/survey/shots/po19.png |
| po20 | Via Sampolo @50% | Via Sampolo | 38.13962, 13.35187, 145 | 5 (0.27) | 0 | /private/tmp/claude-501/survey/shots/po20.png |
| po21 | Via Resuttana @50% | Via Resuttana | 38.1535, 13.33437, 130 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po21.png |
| po22 | Via Notarbartolo @15% | Via Emanuele Notarbartolo | 38.13105, 13.33947, 58 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po22.png |
| po23 | Via Notarbartolo @50% | Via Emanuele Notarbartolo | 38.13179, 13.34222, 73 | 0 (0) | 4 | /private/tmp/claude-501/survey/shots/po23.png |
| po24 | Via Notarbartolo @85% | Via Emanuele Notarbartolo | 38.13315, 13.34758, 72 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po24.png |
| po25 | Via Belgio @50% | Raccordo per Via Belgio | 38.15896, 13.31371, 135 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po25.png |
| po26 | Principe di Paternò @50% | Via Principe di Paternò | 38.13866, 13.33823, 63 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po26.png |
| po27 | Via dei Nebrodi @50% | Via dei Nebrodi | 38.15059, 13.32882, 333 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po27.png |
| po28 | Via Giuseppe Sciuti @50% | Via Giuseppe Sciuti | 38.13684, 13.34053, 154 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po28.png |
| po29 | Via Serradifalco @50% | Via Serradifalco | 38.12529, 13.33873, 146 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po29.png |
| po30 | Via Malaspina @50% | Via Malaspina | 38.12693, 13.34377, 114 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po30.png |
| po31 | Viale Lazio @50% | Viale Lazio | 38.14207, 13.33787, 247 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po31.png |
| po32 | Viale Emilia @50% | Viale Emilia | 38.14658, 13.33845, 209 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po32.png |
| po33 | Via Empedocle Restivo @50% | Via Empedocle Restivo | 38.14527, 13.33533, 153 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po33.png |
| po34 | Piazza Antonino Caponnetto @50% | Piazza Antonino Caponnetto | 38.13486, 13.35772, 123 | 9 (0.79) | 0 | /private/tmp/claude-501/survey/shots/po34.png |
| po35 | Viale Strasburgo @25% | Viale Strasburgo | 38.16065, 13.32269, 150 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po35.png |
| po36 | Viale Strasburgo @70% | Viale Strasburgo | 38.15454, 13.32872, 323 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po36.png |
| po37 | Via Francesco Cilea @50% | Via Francesco Cilea | 38.13538, 13.33775, 345 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/po37.png |
