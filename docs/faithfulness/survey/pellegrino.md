# Survey: Monte Pellegrino, Favorita, Arenella, Acquasanta, Vergine Maria, Addaura

Reviewer notes from side-by-side comparison of in-game street-level shots (1.6 m eye height, time 11:00, headless Chrome) against the real city. `conf` says how a finding was checked: `sv` = compared with Google Street View at the same spot (viewed only, nothing copied), `mem` = from knowledge of the real place, please verify, `game` = defect visible in the game alone. Screenshots live outside the repo under /private/tmp/claude-501/survey/shots/<id>.png (not published).

Terrain-over-road counts come from a ray cast in the running game: up to 70 road centreline samples within 115 m of the viewpoint, first hit from above is either street_asphalt (fine) or a terrain mesh (the road is buried). Depths under 0.15 m are z-fight noise.

## Findings

1. **[high] [pavements]** (`pe07, pe09, pe19, pe20, pe23, pe26, pe28`, conf game) White paving slabs on the hillside at the foot of the mountain: pe07 (left side climbing slope), pe09 (a whole 30 m slope covered in paving up to a building on a plinth), pe19 (a white sheet laid over the slope beside Via Annone), pe20 and pe26 (Arenella to Vergine Maria, a sloping plaza). The raised layer is draped over terrain slopes. Real: terraced gardens, retaining walls, scrub, narrow pavements.

2. **[high] [terrain hides road]** (`pe02`, conf game) Via Pietro Bonanno at 38.16016,13.34982 heading 5: the road is buried. A grass mound sits 0.85 m above the asphalt at the camera and 13 of 37 samples ahead are under terrain (up to 6.6 m). Only a thin white lane sliver shows at left. Real (Street View 68 Via Bonanno Pietro): clear 6 m asphalt road with a dry-stone parapet wall on the valley side and a white gravel verge on the other.

3. **[high] [terrain hides road]** (`pe04, pe05`, conf game) Via Pietro Bonanno (38.15599,13.36017): 3 samples under terrain, one with 2.06 m of ground above the asphalt at the hairpin crown; the road disappears into the hillside and reappears. Same story at pe05 (up to 0.24 m, the crown of the bend is rounded off). Road-shaping bench is too narrow on the outer bend of a switchback.

4. **[high] [terrain hides road]** (`pe06`, conf game) Via Pietro Bonanno (38.15222,13.36189, heading 127): 11 of 58 samples hidden (0.3 to 0.45 m). A flat yellow-green terrain wedge with a hard straight edge cuts across the foreground and covers half the carriageway; the bench boundary is visible as a polygon seam. Real: clean road with a masonry parapet on the right (Street View 61 Via Bonanno Pietro) and a rocky cut with grass on the left.

5. **[high] [terrain hides road]** (`pe08`, conf game) Via Pietro Bonanno (38.15217,13.36476, heading 173): the road runs in a V-shaped trench between two spiky terrain walls; 10 samples hidden, up to 5.94 m of terrain over the asphalt at the next hairpin (309,-4001). The mesh shows sawtooth spikes taller than the road is wide. Terrain relief is wrong here: lidar-less far grid has interpolation noise, and the bench smoothing makes it worse. Real: open hairpin with a parapet and a view over the city.

6. **[high] [vegetation]** (`pe01, pe02, pe03, pe04, pe05, pe06, pe10, pe11, pe17`, conf sv) Wrong tree species and scale on Pellegrino: tall sharp-conical dark spruces, 15 to 25 m, standing in lime-green lawn right on the road edge. Real woods are Aleppo pine and stone pine (umbrella or irregular crowns, 8 to 14 m), with holm oak, carob, agave, prickly pear and macchia, and the slope is dry straw grass with grey limestone outcrops (Street View pe04 spot: yellow grass, grey rock, light green shrubs). Replace the cone with a rounder pine crown, add scrub and rock, drop the lime colour.

7. **[high] [vegetation]** (`pe32, pe33, pe34`, conf sv) Parco della Favorita (Viale Diana 38.1555,13.3452, Viale Ercole): the park is a mown lime-green lawn with isolated spruces and a 6 m asphalt ribbon through it, no kerb, no edge. Real: Viale Diana and Viale Ercole are long straight avenues lined with tall rows of holm oak, plane and pine, behind them dry woodland, orchards (citrus, olive) and walled farm plots (Aleppo pine understory, dry ochre ground). Replace the lawn with dry ground cover plus tree rows and add the roadside verge. Also pe33 has a 2 m wide white kerb stub and a big hexagonal pit in the middle of the lane. Street View at Viale Diana (38.16115,13.34213, heading 337): a pale gravel-and-asphalt track running through a dense shaded tunnel of broad-leaved trees (holm oak, carob) with grass-free dry ground; no lawn at all.

8. **[high] [walls/gardens]** (`pe01, pe02, pe03, pe04, pe05, pe06, pe10, pe11`, conf sv) Via Pietro Bonanno and Via Monte Erta have no parapet wall, guard rail, kerb or milestone. Real: continuous dry-stone or mortared limestone parapet 0.7 to 1 m high on the valley side for most of the climb, villa gates with white gravel verges at the lower bends, utility poles on the uphill side (Street View at 38.16016,13.34982 and 38.15222,13.36189).

9. **[high] [walls/gardens]** (`pe19, pe20, pe18`, conf sv) Via Annone, Addaura (38.18701,13.34539): real street is a narrow 4 to 5 m lane between hedges and villa walls under an Aleppo pine, parked cars along one side and the white limestone cliff above (Street View 70 Via Annone). Game: 8 m asphalt plus an empty white slab to the right and a lone spruce on the left. No walls, no hedges.

10. **[med] [pavements]** (`pe35, pe36`, conf mem) Viale Strasburgo, Via Camarina area: asphalt sits on tan dirt bands (pe35, pe36) with no kerb or pavement, and a lone triangle sliver of black decal floats on the road (pe35). Real Viale Strasburgo is a wide avenue with a central reservation and double tree rows on both sides.

11. **[med] [road layout]** (`pe01, pe03, pe04, pe05, pe10, pe11`, conf sv) Real Via Pietro Bonanno is about 5.5 to 6 m wide with a white dashed centre line and thin edge lines (Street View), game has 8 m of asphalt (OSM width 8) with a solid yellow-white centre dash and big pothole decals. The pothole pits (pe03, pe04, pe05) are far worse than the real surface, which is smooth and recently resurfaced.

12. **[med] [road layout]** (`pe12, pe13, pe14, pe15, pe16`, conf sv) Lungomare Cristoforo Colombo: real is a 2-lane road with a continuous red-white barrier or low wall on the sea side and a sidewalk-less shoulder (Street View 5371 Lungomare Cristoforo Colombo at 38.19582,13.33851: red/white guard posts, walled villas on the right, an arched gateway). Game shows a wide dune-coloured or pale-paved apron where the barrier should be, with no kerb, no posts.

13. **[med] [road layout]** (`pe21, pe22, pe23`, conf mem) Via Vergine Maria / Via Papa Sergio I: wide empty road with sand tint bands on both sides (pe22) and an open dry field at the right. Real Via Vergine Maria is a 2-lane street lined with 3 to 5 storey buildings and a pavement on both sides; the open field is not there.

14. **[med] [terrain hides road]** (`pe12, pe24, pe25`, conf game) Lungomare Cristoforo Colombo / Via Monte Ercta (38.19582,13.33851): 8 hidden samples, up to 2.11 m at Via Monte Ercta (-1985,-8755); Via Colonna Marcatorio 0.85 m on the lungomare; Via Magellano/Via Ambrogio Fogar 0.48 m. Side streets that climb off the lungomare are partly swallowed by the slope.

15. **[med] [terrain/ground]** (`pe13, pe14, pe15, pe16, pe19`, conf game) Cliffs: the limestone face of Pellegrino east of Addaura is convincing (grey with pines in cracks). However the slope below the road falls straight into sea in pe15 with no rocks or wall; real coast has a boulder shore and walls.

16. **[low] [facade style]** (`pe27, pe28, pe29, pe30`, conf game) Acquasanta/Arenella building colour and massing is good (buff, grey, ochre; shutters, balconies). Ground floors are all roller shutters in the same black texture; real streets have a mix of shop fronts, signs and awnings.

17. **[low] [facade style]** (`pe31, pe27, pe29, pe30`, conf game) Nostra Donna del Rotolo and Via Fileti: strong massing and buff colours, shutters. Ground floors are black roller shutters over and over (pe31).

18. **[low] [terrain hides road]** (`pe18, pe23, pe26, pe28, pe30`, conf game) Arenella, Acquasanta, Papa Sergio I, Fileti: 3 to 9 samples each with 0.25 to 0.6 m of terrain above the asphalt on the side streets that leave the main road.

## Viewpoint table

| id | place | road | lat, lon, heading | buried samples (max depth m) | no road mesh | screenshot |
|---|---|---|---|---|---|---|
| pe01 | Via Pietro Bonanno @4% | Via Pietro Bonanno | 38.16628, 13.34789, 322 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pe01.png |
| pe02 | Via Pietro Bonanno @14% | Via Pietro Bonanno | 38.16016, 13.34982, 5 | 13 (6.61) | 0 | /private/tmp/claude-501/survey/shots/pe02.png |
| pe03 | Via Pietro Bonanno @26% | Via Pietro Bonanno | 38.15617, 13.35723, 58 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pe03.png |
| pe04 | Via Pietro Bonanno @38% | Via Pietro Bonanno | 38.15599, 13.36017, 280 | 3 (2.06) | 0 | /private/tmp/claude-501/survey/shots/pe04.png |
| pe05 | Via Pietro Bonanno @50% | Via Pietro Bonanno | 38.15512, 13.36253, 146 | 3 (0.24) | 0 | /private/tmp/claude-501/survey/shots/pe05.png |
| pe06 | Via Pietro Bonanno @62% | Via Pietro Bonanno | 38.15222, 13.36189, 127 | 11 (0.45) | 0 | /private/tmp/claude-501/survey/shots/pe06.png |
| pe07 | Via Pietro Bonanno @74% | Via Pietro Bonanno | 38.15485, 13.3664, 28 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pe07.png |
| pe08 | Via Pietro Bonanno @86% | Via Pietro Bonanno | 38.15217, 13.36476, 173 | 10 (5.94) | 0 | /private/tmp/claude-501/survey/shots/pe08.png |
| pe09 | Via Pietro Bonanno @96% | Via Pietro Bonanno | 38.14963, 13.36557, 133 | 1 (0.17) | 0 | /private/tmp/claude-501/survey/shots/pe09.png |
| pe10 | Via Monte Erta @30% | Via Monte Erta | 38.17475, 13.34312, 324 | 1 (0.03) | 0 | /private/tmp/claude-501/survey/shots/pe10.png |
| pe11 | Via Monte Erta @70% | Via Monte Erta | 38.17132, 13.34856, 227 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pe11.png |
| pe12 | Lungomare Cristoforo Colombo @10% | Lungomare Cristoforo Colombo | 38.19582, 13.33851, 89 | 8 (2.11) | 0 | /private/tmp/claude-501/survey/shots/pe12.png |
| pe13 | Lungomare Cristoforo Colombo @30% | Lungomare Cristoforo Colombo | 38.1889, 13.34853, 97 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pe13.png |
| pe14 | Lungomare Cristoforo Colombo @50% | Lungomare Cristoforo Colombo | 38.18935, 13.35914, 157 | 2 (0.08) | 0 | /private/tmp/claude-501/survey/shots/pe14.png |
| pe15 | Lungomare Cristoforo Colombo @70% | Lungomare Cristoforo Colombo | 38.18025, 13.36568, 163 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pe15.png |
| pe16 | Lungomare Cristoforo Colombo @90% | Lungomare Cristoforo Colombo | 38.16924, 13.36657, 187 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pe16.png |
| pe17 | Padre Giordano Cascini @50% | Via Padre Giordano Cascini | 38.17278, 13.35663, 43 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pe17.png |
| pe18 | Via Agostino Barbarigo @50% | Via Agostino Barbarigo | 38.18957, 13.3503, 284 | 8 (0.52) | 0 | /private/tmp/claude-501/survey/shots/pe18.png |
| pe19 | Via Annone @50% | Via Annone | 38.18701, 13.34539, 109 | 1 (0.08) | 0 | /private/tmp/claude-501/survey/shots/pe19.png |
| pe20 | Gualtiero da Caltagirone @50% | Via Gualtiero da Caltagirone | 38.18797, 13.34743, 111 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pe20.png |
| pe21 | Via Vergine Maria @30% | Via Vergine Maria | 38.16327, 13.36997, 159 | 1 (0.11) | 0 | /private/tmp/claude-501/survey/shots/pe21.png |
| pe22 | Via Vergine Maria @80% | Via Vergine Maria | 38.16075, 13.37116, 160 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pe22.png |
| pe23 | Via Papa Sergio I @50% | Via Papa Sergio I | 38.15754, 13.37091, 188 | 3 (0.63) | 0 | /private/tmp/claude-501/survey/shots/pe23.png |
| pe24 | Via Colonna Marcatorio @50% | Via Colonna Marcatorio | 38.18297, 13.36347, 150 | 7 (0.85) | 0 | /private/tmp/claude-501/survey/shots/pe24.png |
| pe25 | Via Magellano @50% | Via Magellano | 38.1888, 13.35716, 207 | 9 (0.48) | 0 | /private/tmp/claude-501/survey/shots/pe25.png |
| pe26 | Via Lopez De Vega @50% | Via Lopez De Vega | 38.18763, 13.35877, 245 | 2 (0.27) | 0 | /private/tmp/claude-501/survey/shots/pe26.png |
| pe27 | Comandante Simone Gul @50% | Via Comandante Simone Gulì | 38.14128, 13.36714, 154 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pe27.png |
| pe28 | Cardinale Mariano Rampolla @50% | Via Cardinale Mariano Rampolla | 38.14745, 13.36611, 141 | 7 (0.3) | 0 | /private/tmp/claude-501/survey/shots/pe28.png |
| pe29 | Via Papa Sergio Primo @50% | Via Papa Sergio Primo | 38.14964, 13.37079, 179 | 2 (0.03) | 0 | /private/tmp/claude-501/survey/shots/pe29.png |
| pe30 | Via Fileti @50% | Via Fileti | 38.14166, 13.36502, 170 | 3 (0.41) | 0 | /private/tmp/claude-501/survey/shots/pe30.png |
| pe31 | Nostra Donna del Rotolo @50% | via Nostra Donna del Rotolo | 38.1674, 13.3666, 177 | 0 (0) | 2 | /private/tmp/claude-501/survey/shots/pe31.png |
| pe32 | Viale Diana @25% | Viale Diana | 38.16115, 13.34213, 337 | 1 (0) | 0 | /private/tmp/claude-501/survey/shots/pe32.png |
| pe33 | Viale Diana @75% | Viale Diana | 38.14989, 13.34817, 228 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pe33.png |
| pe34 | Viale Ercole @50% | Viale Ercole | 38.1599, 13.34164, 150 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pe34.png |
| pe35 | Margherita di Savoia @50% | Viale Margherita di Savoia | 38.18102, 13.33434, 164 | 1 (0.02) | 0 | /private/tmp/claude-501/survey/shots/pe35.png |
| pe36 | Via Camarina @50% | Via Camarina | 38.17332, 13.33569, 325 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pe36.png |
| pe37 | Via Florio @50% | Via Florio | 38.16564, 13.32481, 302 | 0 (0) | 0 | /private/tmp/claude-501/survey/shots/pe37.png |
