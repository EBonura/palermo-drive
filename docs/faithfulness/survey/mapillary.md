# Faithfulness survey: street level against Mapillary

Second pass of the 304-viewpoint street survey, this time with a real photo next to each game shot. For every viewpoint in `viewpoints.json` the Mapillary Graph API was searched for the best image (within 25 m, widened to 50 m; heading within 45 degrees, or any heading for panoramas, cropped to the viewpoint heading; the most recent capture preferred, with a small penalty for distance and angle). The game was then shot from the same spot (x, z from the viewpoint file, ground height plus 1.6 m, looking along the same heading, 11:00, 1024 by 768, car hidden, camera fov 60 vertical) after the surrounding tiles had finished streaming. Photo and game shot were put side by side and looked at. Every finding below is tagged `mly` (checked against Mapillary). Photos are CC BY-SA and were only looked at; nothing was copied into the game or the repo. Side-by-sides: `/private/tmp/claude-501/palermo-mapillary/sbs/<id>.jpg` (left Mapillary with date, distance and angle in the caption, right game). Extra shots taken at the photo position instead of the viewpoint are `<id>_p.jpg`.

Machine-readable results: `mapillary.json` (one record per viewpoint). Last night's survey is in `SUMMARY.md` and the area files; its layer names are reused here.

## Coverage

Mapillary has a usable photo (right place, right direction) for **138 of 304 viewpoints (45 %)**; 166 are marked no coverage. Of those 166, 121 have no Mapillary image at all within 50 m (mountain roads of Pellegrino, ZEN and the inland part of Mondello, Zisa fringe, most landmarks), 45 have images but all facing another way, and 27 of the 45 have a photo within 25 m looking the opposite direction (usable later as a reverse-direction check). 12 of the 138 matches needed the 50 m radius and 7 are panoramas.

Photo age: median **7.1 years** at 1 Nov 2026 (mean 6.3); by capture year: 2014 x4, 2015 x2, 2017 x7, 2018 x13, 2019 x45, 2021 x40, 2022 x10, 2024 x11, 2026 x6. The real city may have changed since: the 2021 captures show Via Maqueda and the Kalsa with Covid-era cafe terraces and planters, and a number of 2021 to 2024 photos show roadworks hoardings (Via Crispi, Foro Italico, Via della Cala) that will be gone or replaced by now. Where a finding rests on a temporary object it is not counted as a defect.

Comparability of the 138 pairs: 103 good (same place, same direction, same scale), 30 partial (photo 20 to 50 m away, angle off by 30 degrees or more, or a panorama crop), 5 poor (photo looks at the ground, is taken from a roof, or from a garden; ce03, ce08, ce13, lm06, pt33).

| area | viewpoints | with photo | share | median photo age (years) |
|---|---|---|---|---|
| centro | 40 | 19 | 47 % | 5.2 |
| politeama | 37 | 16 | 43 % | 7.6 |
| mondello | 41 | 16 | 39 % | 7.1 |
| pellegrino | 37 | 13 | 35 % | 7.1 |
| zisa | 41 | 15 | 36 % | 7.6 |
| sud | 46 | 29 | 63 % | 5.6 |
| porto | 33 | 18 | 54 % | 5.4 |
| landmarks | 29 | 12 | 41 % | 6.6 |

## Findings by layer and severity

404 findings from 138 photo pairs plus 5 extra shots at the photo position (Quattro Canti, ce09, the cathedral, ce12, ce37). Severity is damage to recognisability: high means a visitor would not read the place as Palermo or as that street, med means the street reads but looks wrong, low is detail.

| layer | high | med | low | total |
|---|---|---|---|---|
| street furniture, props, parked cars | 30 | 42 | 10 | 82 |
| vegetation | 29 | 40 | 7 | 76 |
| road layout, width, markings | 16 | 27 | 9 | 52 |
| walls, gardens, fences | 34 | 10 | 0 | 44 |
| pavements | 15 | 19 | 3 | 37 |
| facade style and colour | 4 | 22 | 10 | 36 |
| building heights and massing (coverage) | 8 | 9 | 17 | 34 |
| terrain | 3 | 2 | 12 | 17 |
| landmarks | 6 | 5 | 4 | 15 |
| coastline and sea | 1 | 3 | 4 | 8 |
| road hidden by terrain | 1 | 1 | 0 | 2 |
| viewpoint notes | 0 | 1 | 0 | 1 |
| **all** | 147 | 181 | 76 | 404 |

Compared with last night's counts (`SUMMARY.md`), the layers that were barely visible from memory are now the biggest: parked cars, walls and hedges, street trees and tram lines were not on the list at all or sat low on it. The `road hidden by terrain` layer is small here only because the terrain-over-road cases are mostly on mountain roads that Mapillary does not cover; the one case seen is zi18 (camera on bare ground, no road mesh) and it is being worked on with the terrain height rebake.

## Top 30 problems, ranked by damage to recognisability

`n` is the number of viewpoints whose findings mention the problem (a keyword count over the findings, so approximate). Ids are survey viewpoint ids; `_p` is the extra shot at the photo position. Items marked WIP are in areas other agents are changing right now.

1. **[high] [landmarks]** Quattro Canti is unreadable: the crossing at the centre of the octagon has no four concave baroque facades with statues, fountains and lamps; the survey viewpoints sit in a 4 m alley, and the shot at the real photo position (16 m north) still shows a blank buff wall and a red awning. (n=3; `ce01 ce02 ce01_p`)
2. **[high] [pavements]** Pale paving slabs, sand-tinted terrain bands and 10 to 20 m aprons where the real street has asphalt up to a kerb and 1.5 to 2 m pavements; the street reads as a plaza or as bare earth. (n=34; `ce09 ce32 po01 po11 po18 po22 po31 mo12 mo28 zi08 zi09 su02 su06 su07 su11 su13 su16 su17 pt03 pt06 pt11 lm18 and more`)
3. **[high] [street furniture, props, parked cars]** Cars parked bumper to bumper on both kerbs are missing in every residential and avenue view (the single strongest Palermo street signature), as are scooters double-parked at the kerb and overflowing wheelie bins; the game roads are empty. (n=52; `po01 po12 po18 po19 po31 pe21 pe22 pe29 zi08 zi20 zi31 su01 su05 su06 su11 su12 su43 pt10 pt11 pt12 lm26 and more`)
4. **[high] [vegetation]** Tree species and shape: spruce cones, faceted ball trees and lime lawn where the real street has plane trees with open crowns, stone pines, ficus canopies, holm oak, jacaranda, oleander and Phoenix or Washingtonia palms; real tree rows meet over the road, game trees stand alone. (n=about 45; `ce12 po02 po10 po31 mo01 mo26 pe06 pe32 zi08 zi09 su08 su09 su13 su45 pt01 pt03 pt04 pt10 lm14 and more`)
5. **[high] [walls, gardens, fences]** Walls, hedges and railings are missing along nearly every villa, garden and hillside street: plaster and rubble garden walls with gates (Mondello, Valdesi, Via Vergine Maria, Via Papa Sergio), iron-railed hedges (Via della Liberta, Notarbartolo), dry-stone parapets and rock cuts (Via Pietro Bonanno), the Norman palace bastion. Buildings and pavement meet the road directly. (n=about 43; `ce12 ce15 po08 mo01 mo02 mo05 mo12 mo18 mo20 mo23 pe06 pe14 pe19 pe21 pe22 pe23 zi28 zi33 su17 su19 su34 su38 su39 su41 su44`)
6. **[high] [road layout, width, markings]** Motorways, expressways and the ring roads are drawn as ordinary 2 lane roads with a dashed centre line: no double steel guard rails, hard shoulder, edge lines, hatched gores, gantry signs, lamp masts or rumble strips (A29, Via Belgio, Viale Regione Siciliana, SS113 Sud Est, Circonvallazione, Sferracavallo ramp). (n=16; `po25 mo25 zi15 zi16 zi17 su09 su10 lm19 lm20 lm21 lm22 lm23`)
7. **[high] [street furniture, props, parked cars]** The Palermo tram line is absent: black iron railing with arched panels, red catenary poles, overhead wires and tram stops down the middle of Viale Leonardo da Vinci, Viale Regione Siciliana, Via Notarbartolo, Corso dei Mille, Via Castellana and the Circonvallazione; the median is bare sand instead. (n=9; `po22 po23 zi05 zi06 zi07 zi19 zi21 su04 lm24`)
8. **[high] [pavements]** Via Maqueda is paved edge to edge as a stone pedestrian plaza; the real street (2021 Covid layout included) is an asphalt road with a white edge line, dashed marks, kerbs and cafe terraces on the margin. (n=3; `ce04 ce05 ce27`)
9. **[high] [building heights and massing (coverage)]** Via Oreto, Via Salvatore Corleone, Via Giovanni Di Stefano, Via Messina Marine and Via Roccazzo are empty tan plains where the real street has market stalls, shop rows, fenced yards, garden walls and rows of low houses; last night's finding 13 is confirmed with photos. (n=12; `su02 su18 su26 su29 su44 zi28 lm26 pt15`)
10. **[high] [landmarks]** Cattedrale: the game wall and tower read as a church but the ribbed white dome, the clock and spire on the tower and the interlaced-arch bands of the Arab-Norman front are missing; the forecourt has bare slabs instead of palms and parterres. (n=2; `ce10 ce10_p`)
11. **[high] [walls, gardens, fences]** Via Pietro Bonanno: real road is 6 m with a continuous dry-stone parapet and an overhanging limestone cut; game road is 8 m, no parapet, spiked terrain wedges at the hairpin and spruce on a lime slope. Terrain heights are being reworked, so only the missing parapet and the width are firm. (n=2; `pe06 pe08`)
12. **[high] [vegetation]** Favorita: Viale Diana is a shaded tunnel of broadleaf oaks and poplars over dry ground; the game has a lime lawn, spruce cones and an open sky (same at Viale del Fante, where a plaster wall and stone pines flank the avenue). (n=2; `pe32 lm01`)
13. **[high] [coastline and sea]** Foro Italico: palm avenue, stone balustrade and clipped hedges are missing and the road sits on a 15 to 20 m tan dirt strip; no sea wall at the water side. (n=5; `pt01 pt03 pt04 pt05 pt19`)
14. **[high] [walls, gardens, fences]** The Palazzo dei Normanni bastion (8 m sloping stone wall along the road) and the stone retaining wall under the ficus of Via Guglielmo il Buono are replaced by open lawn and a flat apartment slab. (n=3; `ce12 ce12_p ce15`)
15. **[high] [facade style and colour]** Old-town alleys and palazzi: arched wooden doorways, wrought-iron balcony canopies on stone brackets, terracotta and ochre plaster with a dark skirt and weathering are replaced by flat buff slabs with small black windows and repeated shutters. (n=4; `ce09 ce16 ce18 ce22`)
16. **[med] [street furniture, props, parked cars]** Street life on the margins: cafe tables, white parasols, planters, A-frame boards, postcard racks, market stalls, works hoardings, bikes; every centro and Kalsa view lacks them. (n=12; `ce04 ce05 ce09 ce27 ce32 po27 su02 su05 pt03`)
17. **[high] [road hidden by terrain]** Viale Regione Siciliana at zi18: camera stands on bare ground and there is no road mesh although the real carriageway is a 3 lane road beside a concrete wall (WIP: terrain height rebake). (n=1; `zi18`)
18. **[high] [road layout, width, markings]** Underpasses and elevated sections are missing: Piazza Tredici Vittime has a lawn where the real road dips under a curved concrete flyover; the Via Giovanni Di Stefano viaduct with parapet is a flat road across a plain. (n=2; `pt14 su29`)
19. **[high] [terrain]** Monte Grifone and Falsomiele: real lower slope is terraced olive scrub under a steep grey limestone face; the game has a smooth beige mound with a few pines. At Via Nostra Donna del Rotolo the cliff that closes the street is absent. (n=3; `su19 su24 pe31`)
20. **[med] [road layout, width, markings]** Pothole, puddle, skid and crack decals are 2 to 4 m across, black hexagons and blue puddles on real surfaces that are worn but even; about 18 viewpoints show clean asphalt in the photo where the game shows pits. (n=about 18; `ce22 pe19 pe23 zi15 su34 su45 pt04 pt05 pt24 lm01`)
21. **[med] [street furniture, props, parked cars]** Billboards, traffic lights on mast arms, road signs, petrol stations (ESSO at Via Montepellegrino, IP at Viale Regione Siciliana), bus stops and kiosks are missing; these are what makes a Palermo junction look like one. (n=30; `po19 su07 po02 mo28 pt05 su26 lm14 lm18 lm23`)
22. **[med] [road layout, width, markings]** Real streets are narrower than the game ones: Via Annone 4 to 5 m against 8 m, Via Bonanno 6 m against 8 m, Mondello and Via Vergine Maria lanes 6 to 7 m against 10 m, with kerbs the game replaces by bollards. (n=8; `pe06 pe19 pe21 mo02 mo06`)
23. **[med] [facade style and colour]** Facade colour and rhythm: real blocks are saturated ochre, orange, yellow, salmon and white with deep stepped balconies, AC units and awnings; game blocks are one buff with louvre windows and balcony ledges that repeat for 100 m (the Notarbartolo and Corso dei Mille blocks come closest). (n=about 33; `po01 po23 po27 po31 zi07 su05 su43 pt12`)
24. **[med] [vegetation]** Palms have 12 m bare trunks with tiny crowns, Mondello and Lungomare palms are far thinner than the real full-crown Phoenix canaries. (n=5; `mo01 mo02 mo09 pe13 pe14`)
25. **[med] [landmarks]** Porta Felice and Porta dei Greci are missing at the ends of the Foro Italico road (WIP: city gates are being added). (n=2; `pt02 pt19`)
26. **[med] [pavements]** Tan terrain-tint rectangles lie across the carriageway or its edge, as in last night's finding 1 (road-shaping bench seams and street layer gaps). (n=5; `su06 mo12 po12 su16 ce32`)
27. **[med] [walls, gardens, fences]** Hedges are 1.5 m flat-topped cuboids; real boulevard hedges are 0.8 m clipped strips along the kerb, and the real planes are slim and light. (n=3; `po08 po09 po10`)
28. **[med] [street furniture, props, parked cars]** Wall tags: SUCA and 800A paint on facades read as a cartoon overlay in Via Maqueda, Via Emerico Amari and the port (WIP: SUCA and 800A wall tags are being reworked). (n=3; `ce27 pt09 pt15`)
29. **[low] [terrain]** Pellegrino cliffs are good where visible (Lungomare, Via Annone) but lime grass and pale slopes replace the grey rock and scrub on the Bonanno road side. (n=4; `pe14 pe16 pe19 pe06`)
30. **[low] [facade style and colour]** Bunting flags hang on facade corners in many street views (ce13, pe29, mo23, su38) and in none of the Mapillary photos. (n=about 10; `ce13 mo23 su37 su38 pe29`)

What is already good, now confirmed against photos: the Monte Grifone and Pellegrino silhouettes behind streets (zi07, zi15, su46), the heights and street widths of the 8 to 12 storey blocks (po18, po23, po24, su11, su42, zi20), the layout of Via della Liberta (po10), the facade massing and balcony brackets in the Via Maqueda shopping street (ce27), the Mondello beach cabin rows (mo01), the limestone cliff at the Lungomare (pe14, pe16), and the Via Messina Marine layout with the sea at the end (su42).

## Re-check of last night's `mem` findings

21 findings were tagged `mem` (from memory). Verdicts: **6 confirmed, 3 partly confirmed, 2 partly refuted, 1 refuted, 9 cannot tell** (no coverage or the photo looks elsewhere).

| finding | verdict | evidence |
|---|---|---|
| centro #4 | partly confirmed | ce12: Photo (2018) shows stone pines, bare planes and a palm along the palace bastion, so spruce cones and lime lawn are wrong; the stone piazza with palms and magnolias is not in the photo (cannot tell). |
| mondello #5 | cannot tell | mo24 mo33 mo34 mo36 mo38: No Mapillary coverage on the ZEN and Tommaso Natale viewpoints. |
| mondello #7 | confirmed | mo26 mo28: Real Via Rosario Nicoletti meets asphalt with a plain kerb and a narrow ledge or wall; there is no sand band, the tan edge band is a game artefact. |
| mondello #11 | partly confirmed | mo26 mo09: Spruce cones are the wrong species wherever photos exist (broadleaf, stone pine, olive); the ZEN fringe itself has no coverage. |
| mondello #12 | cannot tell | mo12: Via Tolomea has no photo; mo12 (Viale Venere) shows the same garden-wall streets under tree canopy that the game lacks, which is consistent but not the same street. |
| mondello #13 | confirmed | ce13 mo23 su37 su38 pe29: None of the Mapillary photos shows bunting; the game hangs it on street corners in many views. |
| mondello #14 | cannot tell | mo01 mo02: No photo of the pier; the game shows the beach cabin rows, which also exist in reality. |
| mondello #15 | partly refuted | mo20 mo21 mo09 mo01: Main Mondello roads (Viale dell Olimpo, Regina Elena, Rosario Nicoletti) have 8 to 10 m arm lamps like the game; only villa lanes use 5 to 6 m ornamental lamps (mo09), so the finding holds for side streets only. |
| mondello #17 | confirmed | mo01 mo05 mo26: Real roadsides are dark hedges, oleander, agave, pines and dry verge; none has a mown lime lawn. |
| pellegrino #10 | cannot tell | pe35 pe36: No Mapillary coverage of Viale Strasburgo at these viewpoints. |
| pellegrino #13 | partly refuted | pe21 pe22 pe23: The game is wrong, but not for the stated reason: Via Vergine Maria and Via Papa Sergio I are lined by long masonry garden walls, cypress and parked cars, not by 3 to 5 storey buildings with pavements. |
| politeama #1 | refuted | po02: The Politeama theatre IS in view in the game at po02 (small cream block at the end of the plaza). The Mapillary photo looks along another street, so the photo cannot confirm the shape of the arch and quadriga; the verdict is from the game shot. |
| politeama #3 | confirmed | po08 po09 po10: Real Via della Liberta has plane rows on both sides and service roads; game hedges are tall flat-topped cuboids (1.5 m) where the real ones are 0.8 m clipped strips. |
| landmarks #4 | cannot tell | lm01: The photo looks away from the stadium; it confirms a plaster park wall and stone pines along Viale del Fante, not lawn and spruce. |
| landmarks #5 | cannot tell | lm08 lm25 lm14: No coverage at La Zisa or Palazzina Cinese. |
| zisa #3 | confirmed | zi15 zi19 zi21: Real medians are a guard-railed or iron-railed strip (with the tram line on Via Castellana), not bare dirt; the survey guess of an oleander row is not what the photos show (iron railing and catenary poles instead). |
| zisa #7 | cannot tell | zi10: No coverage. |
| zisa #12 | cannot tell | zi40 zi41: No coverage. |
| sud #5 | confirmed | su19 su24: Real slope is terraced olive scrub and walled lanes under a steep limestone face; the game has a smooth beige mound. Mandarin orchards themselves are not visible in the photos. |
| aerials #9 | partly confirmed | pe06 pe08 pe14 pe16: Street-level photos show grey limestone cliffs, dry grass tufts and scrub, with pine only in patches; the game mountain is greener and the cliff faces are forest-dotted. Aerial colour itself is not checkable. |
| aerials #12 | cannot tell | ae08: No stadium photos. |

Other `sv` and `game` findings seen again in photos and found right: Via Pietro Bonanno parapet and width (pe06), Via Annone narrow walled lane (pe19), Lungomare retaining wall and cliff (pe14, pe15), Viale Diana tree tunnel (pe32), Foro Italico palm avenue (pt01, pt04), Via Oreto empty plain (su02), motorways as 2 lane roads (zi15, zi16), pothole density (many).

## Method notes and things that went wrong

- Game shots use a free camera at the survey x, z with the car hidden; the lapa is placed within 60 m of the spot so the tiles around it stream in, and a shot is taken only after the world stats show nothing queued, pending or in flight for four polls. The camera height is the game ground height at that point plus 1.6 m, measured in the page after loading. If a ground rebake lands between the height probe and the shot the height is re-read and the shot repeated.
- 11 viewpoints (ce09, ce16, ce25, ce34, lm06, lm20, lm26, pt10, pt11, su43, zi28) did not reach an idle streaming queue (page load timeout or the 100 s limit); their shots were taken anyway and in each the surrounding buildings and road are present, but a missing-tile or ground finding from those should be re-checked. One shot (zi05) caught the loading splash and was retaken.
- The Mapillary compass angle of three images is 0 (ce01, ce02, ce10) and is not reliable; the direction was set by eye for ce01 and ce02 (south).
- Mapillary images are windscreen or phone photos at 1.2 to 1.5 m height with a 60 to 75 degree field; the game camera is 60 degrees vertical in a 4:3 frame (about 75 degrees horizontal), so scale matches within about 20 %.
- Mapillary photos of 2014 and 2015 (po01, po02, po09, po10, ce15) are the oldest; po10 (Via della Liberta, 2014) was re-confirmed by a 2021 photo of the same road (po08).

## Area sections

### Centro storico (centro)

Old-town facades are still the strongest part of the game, but compared with real photos the gap is larger than last night's survey suggested. The three most recognisable places are weak: Quattro Canti (no octagon facades at the crossing), the Cattedrale (tower and wall present, dome and Arab-Norman tracery missing) and Via Maqueda (paved as a plaza). Street life (cafe terraces, parasols, A-frame boards, parked scooters) is missing in every alley. Survey finding 7 (Quattro Canti viewpoints snap to the same alley) is confirmed: the Mapillary photo at that spot is a crowd in an open square. Note: the Maqueda photos were captured in 2021 with a Covid cafe layout.

No coverage (21): ce06 ce07 ce11 ce14 ce17 ce19 ce20 ce21 ce23 ce24 ce26 ce28 ce29 ce30 ce31 ce33 ce35 ce36 ce38 ce39 ce40

| id | photo | d (m) | dh | match | findings h/m/l | main problems |
|---|---|---|---|---|---|---|
| ce01 | 2022-04-19 | 23 | 26 | partial | 2/1/0 | landmarks |
| ce02 | 2022-04-19 | 23 | 26 | partial | 1/0/0 | landmarks |
| ce03 | 2021-08-27 | 12 | 16 | poor | 0/0/0 | - |
| ce04 | 2021-08-27 | 1 | 2 | good | 1/2/0 | pavements |
| ce05 | 2021-09-03 | 3 | 1 | good | 1/2/0 | pavements |
| ce08 | 2024-04-11 | 18 | 16 | poor | 0/0/1 | - |
| ce09 | 2021-08-27 | 46 | 27 | partial | 2/3/0 | pavements |
| ce10 | 2022-04-19 | 30 | 32 | partial | 2/2/1 | landmarks |
| ce12 | 2018-02-18 | 17 | 43 | partial | 4/3/0 | vegetation, walls |
| ce13 | 2021-04-10 | 2 | 44 | poor | 0/1/1 | - |
| ce15 | 2015-02-21 | 15 | 4 | good | 2/1/0 | vegetation, walls |
| ce16 | 2021-08-27 | 6 | 2 | good | 1/1/1 | facade style and colour |
| ce18 | 2024-09-10 | 8 | 0 | good | 1/1/0 | facade style and colour |
| ce22 | 2022-04-19 | 34 | 5 | good | 1/1/1 | facade style and colour |
| ce25 | 2021-05-30 | 16 | 2 | good | 0/2/1 | - |
| ce27 | 2021-09-05 | 1 | 1 | good | 1/1/1 | pavements |
| ce32 | 2017-04-14 | 19 | 14 | good | 2/2/0 | pavements, street furniture |
| ce34 | 2021-05-30 | 2 | 1 | good | 0/3/0 | - |
| ce37 | 2021-05-30 | 43 | 1 | partial | 0/3/2 | - |

Findings, by viewpoint (`mly`):

- **ce01** (2022-04-19, 23 m, partial): Mapillary frame is from the open Quattro Canti crossing 23 m away (Apr 2022); its compass_angle is 0 (unreliable), the view really looks south down Via Maqueda. The game viewpoint was snapped into a 4 m alley.
  - [high] [landmarks] `mly` Quattro Canti is unrecognisable at the viewpoint: real view is the open octagon with two huge baroque corner facades (statues in niches, paired columns, fountains, ornate lamp), game is a blank 4 m ashlar canyon.
  - [med] [viewpoint notes] `mly` The ce01 to ce03 snap point is an alley, not the crossing. Verdict on survey finding 7 below.
  - at the photo position: Game camera moved to the Mapillary position (16 m north of the viewpoint), looking south.
    - [high] [landmarks] `mly` At the crossing itself the game still shows no octagon: a blank buff wall with a red awning at right and a straight street ahead, instead of the two concave baroque corner facades with statues and fountains that dominate the real photo.
- **ce02** (2022-04-19, 23 m, partial): Same photo as ce01.
  - [high] [landmarks] `mly` Same as ce01.
- **ce03** (2021-08-27, 12 m, poor): Mapillary frame points at the tarmac (camera tilted down), nothing to compare. Game view shows an arched wall and a blank alley, no octagon.
- **ce04** (2021-08-27, 1 m, good): Via Maqueda south of the crossing, 1 m, Aug 2021.
  - [high] [pavements] `mly` Real street is an asphalt road with a white edge line and dashed lane marks, narrow stone pavements, bollards and planters, and open cafe tables; game paves the whole width with stone slabs (a pedestrian plaza) and draws two pothole decals on slabs.
  - [med] [street furniture, props, parked cars] `mly` Real street has cafe umbrellas, chairs and tables on the kerb, a no-entry sign, litter bins, a gate and graffiti; the game has none of these.
  - [med] [facade style and colour] `mly` Real left building is a pale 5 storey with iron balconies and shuttered graffiti-covered ground floors; game left wall is a blank buff slab with a few windows.
- **ce05** (2021-09-03, 3 m, good): Via Maqueda north, 3 m, Sept 2021.
  - [high] [pavements] `mly` Real: asphalt road with dashed centre line and stone kerbs, pedestrians walking in the road; game: whole street is stone slab paving.
  - [med] [street furniture, props, parked cars] `mly` Real: high tables and stools, A-frame menu boards, parasols, potted plants, big carved wooden portal on the right. Game has a single parasol and dark roller shutters under red-gold fascias.
  - [med] [facade style and colour] `mly` Real left is cream plaster with arched windows; game left is a tall 8 storey buff tower with no balconies.
- **ce08** (2024-04-11, 18 m, poor): The photo is taken from a church roof terrace (dome and cranes in view), not from the street; the game stands in a lane at Piazza Pretoria. Not comparable. Note: the skyline backdrop of mountains is present in both.
  - [low] [landmarks] `mly` Game shows the palazzo with a clock tower at the end of the lane, which cannot be checked against this photo.
- **ce09** (2021-08-27, 46 m, partial): Photo is 46 m away on a street with a similar heading (Corso Vittorio Emanuele side street), Aug 2021. The game viewpoint is a 3 m alley.
  - [high] [pavements] `mly` Real street is a 9 m asphalt road with a white centre line, shop terraces and pedestrians; game shows a 3 m stone-slab alley with a tan mid-width. See ce09_p for the shot at the photo position.
  - [med] [facade style and colour] `mly` Real facades are 5 storey with deep iron balconies, plants, arched shopfronts and postcard stands; game walls are flat buff with a few balconies and a single dark arch.
  - [med] [street furniture, props, parked cars] `mly` Bicycles, A-frame boards, postcard racks, benches, festoon lights missing.
  - at the photo position: Game camera at the photo position (46 m along the street).
    - [high] [pavements] `mly` The game ground here is a tan terrain-tint plain instead of an asphalt road with a centre line, and the facades are set back from it: the street surface layer is missing.
    - [med] [facade style and colour] `mly` Real street is a continuous 5 storey wall with arched shopfronts and balconies; game has an isolated 4 storey block and a gap.
- **ce10** (2022-04-19, 30 m, partial): Photo is the cathedral south front from the forecourt, 30 m away, Apr 2022; heading differs by 32 degrees.
  - [high] [landmarks] `mly` Game cathedral side is a flat buff wall with pointed lancet windows and a battlement; the real one is a many-layered Arab-Norman front with interlaced arch bands, a tall clock tower with a pyramid spire, a ribbed white dome and a flanking Gothic porch.
  - [med] [vegetation] `mly` Real forecourt has palms, clipped globe shrubs and a hedge parterre; game has blocky plinths and white boxes (statue bases without statues).
  - [low] [street furniture, props, parked cars] `mly` Statue plinths are blank cuboids, real balustrade carries marble statues.
  - at the photo position: Game camera at the photo position, looking at the cathedral's south front.
    - [high] [landmarks] `mly` Cathedral is present with the right overall layout (battlemented wall, a square tower at the left), which is better than the survey feared, but it lacks the ribbed white dome, the tower clock and spire, and the interlaced-arch bands; the wall has plain pointed lancets. Recognisable only to someone who knows the building.
    - [med] [vegetation] `mly` Forecourt has bare slabs and a lawn patch; real has palms, clipped shrubs and a flower parterre.
- **ce12** (2018-02-18, 17 m, partial): 17 m away, Feb 2018, winter, windscreen photo looking along the Palazzo dei Normanni bastion, 43 degrees off heading.
  - [high] [vegetation] `mly` Real roadside has stone pines, bare planes and a palm; game has lime lawn with spruce cones and fat ball trees.
  - [high] [walls, gardens, fences] `mly` The long bastion wall of the palace on the right (grey-ochre, 8 m high, sloping base) is missing; the game shows open lawn and an apartment slab beyond.
  - [med] [road layout, width, markings] `mly` Real road is a 2 lane street with a dashed line, kerbs and a bus stop; game has a smudged zebra crossing, black skid pairs and pothole decals.
  - [med] [street furniture, props, parked cars] `mly` City bus, bus stop pole, slim curved lamp posts missing.
  - at the photo position: Game camera at the photo position.
    - [high] [walls, gardens, fences] `mly` The 8 m high palace bastion wall along the right of the road is absent; the game shows open lawn with spruce cones and ball trees.
    - [high] [vegetation] `mly` Spruce cones at the horizon instead of stone pines, bare planes and a palm.
    - [med] [road layout, width, markings] `mly` Road is flanked by pale paving and a tan dirt strip; skid pairs across the lane.
- **ce13** (2021-04-10, 2 m, poor): Corso Re Ruggero, 2 m, Apr 2021, 44 degrees off; the photo is a close-up of a gate pier and a glass bus shelter, with a 5 storey cream block across the road.
  - [low] [facade style and colour] `mly` Real far block is cream with small balconies and shopfronts; game blocks are ochre with dark window grids (colour and rhythm are close enough, bunting at upper right of the game shot is out of place).
  - [med] [road layout, width, markings] `mly` Real road is a narrow curve with kerbs; game is 14 m of asphalt with a 10 m pale pavement either side.
- **ce15** (2015-02-21, 15 m, good): Via Guglielmo il Buono, 15 m, Feb 2015.
  - [high] [vegetation] `mly` Real left side is a tall dressed-stone retaining wall under big ficus and holm oak; game has a bare 5 storey ochre slab with garage shutters at the foot and no trees.
  - [high] [walls, gardens, fences] `mly` The retaining wall is replaced by building massing; the upper palazzo set back behind the wall is missing.
  - [med] [road layout, width, markings] `mly` Real road has a yellow-black bollard median on the right with kerb, solid edge lines and two lanes; game road is a flat strip with no markings except a pale kerb.
- **ce16** (2021-08-27, 6 m, good): Via Porta di Castro, 6 m, Aug 2021.
  - [high] [facade style and colour] `mly` Real lane is an old-town alley: arched wooden doors, wrought-iron balcony canopies, cream and ochre plaster, awnings, plants on the street; game is a 4 m canyon with one blank buff wall (left) and shuttered shopfronts (right).
  - [med] [street furniture, props, parked cars] `mly` Parked Pandas and a delivery van, potted plants, a folding stall at the kerb: none present.
  - [low] [pavements] `mly` Game adds a raised pale pavement on one side; real has none.
- **ce18** (2024-09-10, 8 m, good): Alley near Ballaro, 8 m, Sept 2024.
  - [high] [facade style and colour] `mly` Real alley is a 4 m canyon of weathered terracotta and ochre plaster with a dark painted skirt, a baroque dome at the end, carved balcony brackets, scooters and cars parked tight; game has two tall flat ashlar blocks with small black windows.
  - [med] [street furniture, props, parked cars] `mly` Parked cars, scooters, a manhole cover, patched surface; game has a light-blue box car dead centre and cardboard stacks, and a raised pale pavement the real alley does not have.
- **ce22** (2022-04-19, 34 m, good): Via Cavour, 34 m, Apr 2022.
  - [high] [facade style and colour] `mly` Real street walls are 5 storey baroque palazzi with deep wrought-iron balconies on carved stone brackets, weathered brown plaster and arched doors; game has smooth buff blocks with small windows plus a 7 storey modern slab on the right.
  - [med] [road layout, width, markings] `mly` Real road has painted arrows, a bus bay, parked cars and kerbs; game has a zebra crossing drawn over pits and a puddle decal.
  - [low] [street furniture, props, parked cars] `mly` Terracotta pots with agave on the pavement, wall-mounted lanterns: absent.
- **ce25** (2021-05-30, 16 m, good): Via Vittorio Emanuele towards the Cala, 16 m, May 2021.
  - [med] [coastline and sea] `mly` Real view ends at the marina with masts and a Phoenix palm group at the quay; game shows trees and a yellow bus at a plaza and no masts.
  - [med] [facade style and colour] `mly` Real left is a pale institutional block with tall arched windows; game left is dark brown with garage doors, close in height but wrong colour.
  - [low] [street furniture, props, parked cars] `mly` Real has a bollard kerb on the left, parked cars along the quay, a no-parking sign; game has none.
- **ce27** (2021-09-05, 1 m, good): Via Maqueda near the station, 1 m, Sept 2021.
  - [high] [pavements] `mly` Real street is asphalt with a white edge line, a stone kerb and terracotta planters; game paves the whole width with stone slabs and shows people walking in it. The pedestrian-plaza reading is wrong for Via Maqueda south of the crossing.
  - [med] [street furniture, props, parked cars] `mly` Large cream parasols, boxed trees in terracotta planters, outdoor tables and a bench with seated people are missing from the game, which does have a small awning and parasol far away.
  - [low] [facade style and colour] `mly` Facade massing and balcony brackets are close, and the game left building is a good match; SUCA wall tag on the right facade is being worked on.
- **ce32** (2017-04-14, 19 m, good): Via Torquato Tasso / Via Crispi junction, 19 m, Apr 2017 (blur).
  - [high] [pavements] `mly` Game has a big tan sand patch on the left of the carriageway and a long skid rectangle; real has kerbs, pavements and stone pines at the roadside.
  - [high] [street furniture, props, parked cars] `mly` Real street is full of moving and parked cars and shop awnings with stalls at the kerb; game has an empty road with a bus at the far end.
  - [med] [vegetation] `mly` Stone pines and a hedge strip (left of the real photo) missing; game has one round tree on the right.
  - [med] [facade style and colour] `mly` Real right side is a concrete block with an arcaded ground floor and shops; game right side is a tall buff building with a tiered edge and no arcade.
- **ce34** (2021-05-30, 2 m, good): Via Abramo Lincoln, 2 m, May 2021; a game bus blocks half the view.
  - [med] [vegetation] `mly` Real street has a blooming jacaranda and rows of cars parked under it; game has none near the camera.
  - [med] [facade style and colour] `mly` Real left is a white neoclassical palazzo with iron balconies; right is low shuttered warehouses. Game right shows a long 4 storey arcaded palazzo, which is the wrong building type on that side.
  - [med] [street furniture, props, parked cars] `mly` Rows of parked cars on the left kerb missing.
- **ce37** (2021-05-30, 43 m, partial): Via Venti Settembre / Via Vittorio Emanuele, 43 m, May 2021; the photo looks at a wide junction with a hoarded building site and a large cream palazzo behind palms.
  - [med] [building heights and massing (coverage)] `mly` Real view opens onto a wide junction with a big neoclassical palazzo and palms; game stays in a closed 8 m canyon of buff and brown blocks with roller shutters and no sight line to the palazzo.
  - [med] [street furniture, props, parked cars] `mly` Orange mesh site hoarding, a billboard, a column of parked and queued cars, palms: none in the game.
  - [low] [road layout, width, markings] `mly` Game road has a broad crack decal and a puddle; real is clean asphalt.
  - at the photo position: Game camera at the photo position.
    - [low] [building heights and massing (coverage)] `mly` The cream palazzo at the end of the street is present as a buff block with the right massing, and the junction width is close; the game has an arched church-like block and a bus in the lane.
    - [med] [street furniture, props, parked cars] `mly` Hoarding, billboard, car queue missing; palms replaced by ball trees.

### Politeama, Liberta, Notarbartolo, Strasburgo (politeama)

Via della Liberta (po10) and Via Notarbartolo (po22 to po24) are the best Politeama matches in layout and height. What is missing is the tram (Notarbartolo railing and catenary), parked cars on every kerb, kerbside hedges at the right size, and street trees: real planes and ficus form canopies, the game's dome trees are heavier and darker. Ring-road and Via Francesco Crispi views (po11, po12, po25) lack hoardings and guard rails and show large pale or sand-tinted aprons. The theatre itself is visible at the end of the paved plaza in po02 (small).

No coverage (21): po03 po04 po05 po06 po07 po13 po14 po15 po16 po17 po20 po21 po26 po28 po29 po30 po32 po33 po35 po36 po37

| id | photo | d (m) | dh | match | findings h/m/l | main problems |
|---|---|---|---|---|---|---|
| po01 | 2014-06-29 | 21 | 4 | good | 1/2/0 | street furniture |
| po02 | 2014-06-29 | 22 | 1 | partial | 1/1/1 | vegetation |
| po08 | 2021-09-06 | 4 | 1 | partial | 1/2/0 | walls |
| po09 | 2015-02-12 | 12 | 31 | partial | 0/2/1 | - |
| po10 | 2014-06-02 | 2 | 3 | good | 0/3/0 | - |
| po11 | 2022-04-19 | 6 | 1 | good | 1/1/1 | pavements |
| po12 | 2022-04-19 | 2 | 9 | good | 1/2/0 | road layout |
| po18 | 2021-05-30 | 5 | 4 | good | 1/2/1 | street furniture |
| po19 | 2022-04-19 | 8 | 4 | good | 1/1/1 | street furniture |
| po22 | 2019-03-25 | 4 | 5 | good | 1/2/0 | street furniture |
| po23 | 2019-03-25 | 2 | 2 | good | 1/1/1 | street furniture |
| po24 | 2019-03-25 | 16 | 6 | good | 1/0/2 | street furniture |
| po25 | 2024-04-24 | 4 | 1 | good | 1/1/1 | road layout |
| po27 | 2017-04-14 | 23 | 31 | partial | 2/2/0 | street furniture, vegetation |
| po31 | 2018-06-03 | 1 | 8 | good | 2/1/1 | street furniture, vegetation |
| po34 | 2022-04-19 | 7 | 9 | partial | 1/2/1 | walls |

Findings, by viewpoint (`mly`):

- **po01** (2014-06-29, 21 m, good): Via near Piazza Ruggero Settimo, 21 m, June 2014 (early morning).
  - [high] [street furniture, props, parked cars] `mly` Real street has cars parked on both kerbs, bikes, dustbins and a yellow edge line; game has an empty road with a dumpster in the foreground and a dark slab decal.
  - [med] [facade style and colour] `mly` Real facades are saturated yellow and orange plaster, 5 storey with deep stepped balconies, shop fronts with steel shutters, AC units and satellite dishes; game facades are dull buff with louvres.
  - [med] [pavements] `mly` Game has 6 m pale pavements either side of an 11 m road; real has 1.5 m pavements.
- **po02** (2014-06-29, 22 m, partial): Piazza Castelnuovo, 22 m, June 2014; the photo is taken in the avenue beside the piazza (planes, parked cars), the game camera stands in the paved plaza.
  - [high] [vegetation] `mly` Real avenue is a continuous canopy of plane and jacaranda trees along both sides of Via Ruggero Settimo; game has ball trees and a large paved plaza with a grey slab floor.
  - [med] [street furniture, props, parked cars] `mly` Row of parked cars and motorbike parking on the left kerb, no-parking sign, café parasols missing; game has pedestrians standing in a tinted slab plaza.
  - [low] [landmarks] `mly` The Politeama is visible in the game at the far end as a cream block with a stepped pediment, so survey finding 1 (not in view) does not hold at this spot; it is a few pixels wide and the colonnade arch and quadriga are not distinguishable.
- **po08** (2021-09-06, 4 m, partial): Via della Liberta west side, 4 m, Sept 2021, dusk.
  - [high] [walls, gardens, fences] `mly` Real left side is a tall dark-green iron railing on a stone plinth along a garden, with leaves behind it, plus a long row of parked cars; game has cube hedges (flat-topped boxes) and big dome trees.
  - [med] [vegetation] `mly` Real trees are slim planes with irregular crowns; game trees are huge flat-shaded domes with straight brown trunks and no understory.
  - [med] [street furniture, props, parked cars] `mly` Hexagon-pattern pavement, ornate black lamp on the corner, parked cars: lamp missing, car row replaced by a single white car.
- **po09** (2015-02-12, 12 m, partial): Via della Liberta service road, 12 m, Feb 2015 (sun flare, 31 degrees off).
  - [med] [walls, gardens, fences] `mly` Real right side is a black iron railing on a low plinth in front of a 7 storey 1960s block with shop signs; game has cube hedges and open pavement.
  - [med] [vegetation] `mly` Real trees are sparse bare-trunked planes; game has a dense tunnel of dark domes.
  - [low] [road layout, width, markings] `mly` Real has a kerbed median and a parking lane; game has two white dashed lines on an empty road.
- **po10** (2014-06-02, 2 m, good): Via della Liberta, 2 m, June 2014. This is the best match in Politeama: boulevard layout, tree rows, hedges and palazzi all read.
  - [med] [vegetation] `mly` Real planes are tall with open, light-green crowns and trunks that lean; game trees are dark, heavy low-poly domes on straight brown trunks.
  - [med] [walls, gardens, fences] `mly` Real hedges are clipped 0.8 m strips along the kerb; game hedges are 1.5 m cuboids.
  - [med] [road layout, width, markings] `mly` Real road has a thick yellow median stripe, a double white line and a bus lane; game has two thin white dashed lines. Palms (left) and purple jacaranda in the distance missing.
- **po11** (2022-04-19, 6 m, good): Via Francesco Crispi, 6 m, Apr 2022.
  - [high] [pavements] `mly` Real right side is a continuous construction hoarding with concrete barriers and billboards; game has a tan sand plain stretching to the horizon with ball trees.
  - [med] [street furniture, props, parked cars] `mly` Billboards, a truck, hoarding, curved lamp posts missing; game has a box car in the foreground.
  - [low] [terrain] `mly` Monte Pellegrino silhouette appears in both, the game one is pale.
- **po12** (2022-04-19, 2 m, good): Via Francesco Crispi south, 1 m, Apr 2022.
  - [high] [road layout, width, markings] `mly` Real road is a narrow one-way service lane (about 6 m) with parked cars along the kerb, running beside a sunken carriageway behind a concrete wall and railings; game has a wide open junction with 20 m of pale and sand-tinted apron and scattered cars.
  - [med] [facade style and colour] `mly` Real right block is a white modern 9 storey with glass balcony parapets and shopfronts; game right block is a ribbed buff slab with dark louvre windows.
  - [med] [street furniture, props, parked cars] `mly` Cars parked bumper to bumper missing; the real curved lamp and tall pole are replaced by stray dumpsters.
- **po18** (2021-05-30, 5 m, good): Via Montepellegrino, 5 m, May 2021.
  - [high] [street furniture, props, parked cars] `mly` Real street is lined with cars on both kerbs, motorbikes and a speed-limit sign; game has a yellow bus filling the right half and no parked cars.
  - [med] [vegetation] `mly` Flowering jacaranda and a palm at the junction ahead missing.
  - [med] [pavements] `mly` Game has a tan band and pale apron to the left of the road; real has a kerb and a car row.
  - [low] [building heights and massing (coverage)] `mly` The 10 to 12 storey balconied blocks on both sides match real heights well, which is the best part of this view; game tint is browner and balconies are flat.
- **po19** (2022-04-19, 8 m, good): Via Montepellegrino, 8 m, Apr 2022.
  - [high] [street furniture, props, parked cars] `mly` Real has parked cars along both sides in a continuous row, an ESSO station with a red canopy and a price pylon, a scaffolded building and bare trees; game has a red box car and an empty road.
  - [med] [landmarks] `mly` The ESSO station is a local landmark of this junction and is missing.
  - [low] [building heights and massing (coverage)] `mly` Game right side is a 3 storey garage block with balconies; real right is a 7 storey block next to the station. Distant towers are fine.
- **po22** (2019-03-25, 4 m, good): Via Notarbartolo, 4 m, Mar 2019.
  - [high] [street furniture, props, parked cars] `mly` Real street has an iron-railed tram median with overhead wires, queued cars, and a hedge and tree row behind the railing; game has an open junction with a huge pale plaza bite and one white van.
  - [med] [vegetation] `mly` Rounded evergreen trees (laurel and ficus) behind the railing missing.
  - [med] [pavements] `mly` Game apron is 15 m of pale slab; real road meets a railing and kerb.
- **po23** (2019-03-25, 2 m, good): Via Notarbartolo, 2 m, Mar 2019.
  - [high] [street furniture, props, parked cars] `mly` Real left side is a black iron railing on a concrete plinth guarding the tram line, with overhead catenary on red poles; the right has bus-stop boards, a stone pine and kiosks. Game has none of these (tram line missing) and a floating box car plus dumpsters.
  - [med] [facade style and colour] `mly` Real blocks are orange, yellow and cream with deep balconies and awnings; game blocks are uniform buff with a regular balcony ledge band.
  - [low] [building heights and massing (coverage)] `mly` Street width and 8 to 9 storey block heights are a good match.
- **po24** (2019-03-25, 16 m, good): Via Notarbartolo, 15 m, Mar 2019.
  - [high] [street furniture, props, parked cars] `mly` Real has an Osteria sign, an Italian flag on the palazzo, shop fronts at street level, scooters and cars at the kerbs; game has a white car in the foreground and a pedestrian only.
  - [low] [facade style and colour] `mly` Colour and balcony rhythm of the game blocks are close to real (the real left block is white with long balconies, game left block is orange-brown).
  - [low] [building heights and massing (coverage)] `mly` Street width and 8 storey height are a good match; this is one of the closer Politeama views.
- **po25** (2024-04-24, 4 m, good): Via Belgio ring road, 4 m, Apr 2024, overcast.
  - [high] [road layout, width, markings] `mly` Real road is a motorway-grade carriageway with double steel guard rails on both sides, a hatched gore, green exit signs and tall lamp masts; game has a 2 lane road with a dashed centre line and sand bands 15 m wide either side.
  - [med] [pavements] `mly` Sand bands read as bare earth; real has a rail and scrub verge only 1 to 2 m wide.
  - [low] [building heights and massing (coverage)] `mly` Mid-rise blocks on the horizon exist in both.
- **po27** (2017-04-14, 23 m, partial): Via dei Nebrodi, 23 m, Apr 2017, 31 degrees off.
  - [high] [vegetation] `mly` Real left is a median planted with large ficus and broadleaf trees, right side has parked cars under tree canopy; game has no trees and a huge pale plaza on both sides.
  - [high] [street furniture, props, parked cars] `mly` Cars parked bumper to bumper on the right kerb, a cafe terrace with awning: missing.
  - [med] [facade style and colour] `mly` Game left block is a uniform 6 storey slab with identical balconies for 150 m; real blocks are mixed cream and white with different heights.
  - [med] [road layout, width, markings] `mly` Skid-mark pairs and a black 3 m hexagon in the game road are far worse than the real surface.
- **po31** (2018-06-03, 1 m, good): Viale Lazio, 1 m, June 2018.
  - [high] [vegetation] `mly` Real avenue has big plane trees overhanging both kerbs, a palm and a stone-pine row; game has bare pale paving and one lawn strip on the right.
  - [high] [street furniture, props, parked cars] `mly` Cars parked on the right kerb with blue-line bays, traffic lights on mast arms, a road sign: missing.
  - [med] [pavements] `mly` Game pavement apron is 12 m wide on each side; real has 2 m pavements with trees.
  - [low] [facade style and colour] `mly` Real left block is white with long balconies, right block cream; game blocks are buff and brown with louvres.
- **po34** (2022-04-19, 7 m, partial): Piazza Antonino Caponnetto, 7 m, Apr 2022, 9 degrees off, strong sun flare.
  - [high] [walls, gardens, fences] `mly` Real right side is a 5 m transparent and black noise barrier on a raised ramp with a guard rail and a 40 km/h sign; game has a plain ashlar-textured retaining wall.
  - [med] [coastline and sea] `mly` Real horizon has port gantry cranes and a container yard; game has a small tan shop and ball trees.
  - [med] [pavements] `mly` Game has a tan sand band left and a pale apron right of the road; real has a kerb and guard rail.
  - [low] [road layout, width, markings] `mly` Game has a long black crack line across the lane.

### Mondello, Valdesi, Sferracavallo, Tommaso Natale, ZEN (mondello)

Real Mondello is a town of walled gardens: plaster and rubble walls with gates, hedges, oleander and stone pines, kerbside parked cars, 6 to 7 m lanes. The game replaces them with pale paved aprons, a lime lawn, bollards and a 10 m road. Viale Regina Elena (mo01, mo02) has the right ingredients (palms, beach cabins, ridge) but no walls and wrong palm proportions. mo25 shows the real Via Pietro Calandra link is a motorway ramp with a gantry sign, not the residential street the survey assumed. No Mapillary coverage exists for ZEN, Tommaso Natale and most of the inland blocks (mo03, mo10 to mo16, mo19, mo24, mo27 to mo41).

No coverage (25): mo03 mo04 mo08 mo10 mo11 mo13 mo14 mo15 mo16 mo19 mo24 mo27 mo29 mo30 mo31 mo32 mo33 mo34 mo35 mo36 mo37 mo38 mo39 mo40 mo41

| id | photo | d (m) | dh | match | findings h/m/l | main problems |
|---|---|---|---|---|---|---|
| mo01 | 2019-10-03 | 4 | 1 | good | 1/2/2 | walls |
| mo02 | 2022-04-19 | 12 | 4 | good | 1/2/1 | walls |
| mo05 | 2019-10-05 | 3 | 0 | good | 1/2/1 | walls |
| mo06 | 2019-10-03 | 4 | pano | partial | 1/2/0 | walls |
| mo07 | 2019-10-03 | 3 | pano | partial | 0/1/1 | - |
| mo09 | 2019-10-03 | 7 | 1 | good | 2/1/0 | vegetation, walls |
| mo12 | 2019-10-03 | 4 | 1 | good | 2/0/1 | pavements, walls |
| mo17 | 2019-10-05 | 5 | 13 | partial | 0/2/0 | - |
| mo18 | 2019-10-03 | 3 | pano | partial | 1/1/1 | walls |
| mo20 | 2019-10-03 | 4 | 3 | good | 1/1/1 | walls |
| mo21 | 2019-10-03 | 11 | pano | partial | 0/1/2 | - |
| mo22 | 2019-10-03 | 11 | pano | partial | 0/2/0 | - |
| mo23 | 2019-10-05 | 6 | 0 | good | 1/2/0 | walls |
| mo25 | 2024-04-24 | 6 | 1 | good | 1/1/0 | road layout |
| mo26 | 2019-10-05 | 1 | 0 | good | 1/1/1 | vegetation |
| mo28 | 2019-10-05 | 1 | 4 | good | 0/1/2 | - |

Findings, by viewpoint (`mly`):

- **mo01** (2019-10-03, 4 m, good): Viale Regina Elena, 4 m, Oct 2019.
  - [high] [walls, gardens, fences] `mly` Real left side is a continuous plastered garden wall with villas, palms and parked cars behind it; right side is a raised kerb with a dense strip of oleander, agave and stone pines. Game has a wide pale promenade on both sides, widely spaced palms and open lawn with no walls or hedges.
  - [med] [vegetation] `mly` Real trees are stone pines, date palms with full crowns and oleander; game palms have 12 m bare trunks and small crowns, and lollipop ball trees. The palm avenue idea itself is right.
  - [med] [pavements] `mly` Game paves 8 m each side; real has a plain kerb with a 1 m ledge.
  - [low] [coastline and sea] `mly` Game has a row of coloured beach cabins on the right (good, they exist at Mondello) and the Capo Gallo ridge is the right shape.
  - [low] [street furniture, props, parked cars] `mly` Parked cars along the left kerb: missing.
- **mo02** (2022-04-19, 12 m, good): Viale Regina Elena, 12 m, Apr 2022.
  - [high] [walls, gardens, fences] `mly` Real left is a white plastered wall with a gate, tropical shrubs over it and parked cars; game has an open bright strip, a lone building and no wall.
  - [med] [vegetation] `mly` Real has a huge Phoenix palm with a full crown and stone pines at the road edge; game has palm trunks with tiny crowns.
  - [med] [road layout, width, markings] `mly` Real road is 7 m, with a kerbed sandy verge and a bus stop on the right; game is a 10 m carriageway with a 3 m pale strip, bollards and no bus stop.
  - [low] [street furniture, props, parked cars] `mly` Bus stop pole and timetable board missing.
- **mo05** (2019-10-05, 3 m, good): Via Principe di Scalea, 3 m, Oct 2019 (backlit).
  - [high] [walls, gardens, fences] `mly` Real right side is a dense tall hedge and tree wall behind a kerb, left side has parked SUVs along a clipped hedge and a villa; game has a lime lawn strip with pedestrians, scattered ball trees and an open pale paved walk.
  - [med] [road layout, width, markings] `mly` Real road has a double white centre line and a solid edge line; game has a single dashed line.
  - [med] [street furniture, props, parked cars] `mly` Parked cars along the left kerb missing; one floating light-blue box car at left instead.
  - [low] [building heights and massing (coverage)] `mly` Villas in the distance are buff boxes; real villas are mostly hidden by greenery.
- **mo06** (2019-10-03, 4 m, partial): Mondello (pano crop 97 degrees off heading, so the crop may not match the game direction), 4 m, Oct 2019.
  - [high] [walls, gardens, fences] `mly` Real street is a 6 m lane between plaster garden walls and hedges under mature stone pines and eucalyptus, with parked cars and a Liberty villa tower; game is a 10 m road with a broad pale pavement, a lawn, a lone tall palm and a 3 m pothole decal.
  - [med] [vegetation] `mly` Real trees are huge irregular broadleaf and stone pines; game trees are faceted domes of one size.
  - [med] [road layout, width, markings] `mly` Row of black hexagon pits plus a 3 m pit in the foreground; real surface is even with one manhole.
- **mo07** (2019-10-03, 3 m, partial): Viale Galatea (pano crop faces a fence), 3 m, Oct 2019, 25 degrees off.
  - [med] [walls, gardens, fences] `mly` Real roadside is a wooden picket fence on a low wall under a leaning broadleaf tree and thick shrubs; game has pale pavement, bollards and a long flat wall in the distance.
  - [low] [vegetation] `mly` Overgrown understory shrubs missing.
- **mo09** (2019-10-03, 7 m, good): Via Piano di Gallo, 7 m, Oct 2019.
  - [high] [vegetation] `mly` Game fills the roadside with a grove of fat, 15 m tall palm trunks with spiky crowns; real roadside is stone pine and holm oak woodland with a few palms and agave, and a limestone cliff above.
  - [high] [walls, gardens, fences] `mly` Real left side is a rubble stone retaining wall topped with an iron fence and a villa garden; game has bollards and paving only.
  - [med] [street furniture, props, parked cars] `mly` Real bend has a coach, wheelie bins, a blue ornamental lamp and a hotel building; none present.
- **mo12** (2019-10-03, 4 m, good): Viale Venere, 4 m, Oct 2019.
  - [high] [pavements] `mly` Real road runs straight between garden walls and hedges with trees overhead, asphalt to the kerb; game has 12 m wide pale pavements with a tan terrain tongue at the left edge and a big dark rectangle patch on the carriageway.
  - [high] [walls, gardens, fences] `mly` Garden walls, plaster fences, tree canopy and a parked car row missing.
  - [low] [terrain] `mly` The Pellegrino-Gallo ridge in the distance is a convincing match and the pine dots on it are a good touch.
- **mo17** (2019-10-05, 5 m, partial): Via Partanna Mondello, 5 m, Oct 2019 (backlit, camera low).
  - [med] [road layout, width, markings] `mly` Real road is a 3 lane road with a steel guard rail, tufted agave and ornamental grass at the kerb and a lamp-post line; game has lawn strip, pale paving and bollards.
  - [med] [street furniture, props, parked cars] `mly` Commercial frontage (car dealer with signs and fence) and billboards missing; game shows an ashlar-textured blank wall.
- **mo18** (2019-10-03, 3 m, partial): Mondello (pano crop 93 degrees off), 3 m, Oct 2019.
  - [high] [walls, gardens, fences] `mly` Real lane is hemmed by a rubble wall topped with a diamond mesh fence on the right and a villa on the left under trees; game puts a buff box with a green door right at the camera and a wide pale piazza behind.
  - [med] [vegetation] `mly` Mature trees over the lane missing.
  - [low] [building heights and massing (coverage)] `mly` Game pale paved area to the right at the end of the lane; real has houses.
- **mo20** (2019-10-03, 4 m, good): Viale dell'Olimpo, 4 m, Oct 2019.
  - [high] [walls, gardens, fences] `mly` Real right side is villa gardens with a brick or stone wall, gates and cypress; game has a pale paved apron with a red car.
  - [low] [road layout, width, markings] `mly` A central reservation with a verge is present in both (good); game strip is tinted sand and weedy lawn, real is a concrete kerbed median with oleander.
  - [med] [vegetation] `mly` Cypress, stone pine and flowering trees lining the road are missing.
- **mo21** (2019-10-03, 11 m, partial): Viale dell'Olimpo (pano), 11 m, Oct 2019.
  - [low] [road layout, width, markings] `mly` Real road has solid white edge lines, hatched shoulder and a steel crash barrier; game has a dashed centre line and an unmarked edge with a sand tint verge.
  - [med] [vegetation] `mly` Real left side is a row of mature ficus and eucalyptus with trunks leaning; game trees are low-poly balls with a single spruce cone.
  - [low] [terrain] `mly` Backdrop mountain is right in shape (Monte Gallo and Pellegrino ridge), game ridge is smoother and greener.
- **mo22** (2019-10-03, 11 m, partial): Viale dell'Olimpo (pano), 11 m, Oct 2019.
  - [med] [road layout, width, markings] `mly` Real road is a dual carriageway with white edge lines and curved kerbs, hedges and villa walls on the right; game has a single carriageway between two wide sand-and-lawn strips.
  - [med] [walls, gardens, fences] `mly` Villa walls and hedges at the road edge missing.
- **mo23** (2019-10-05, 6 m, good): Via Sferracavallo, 6 m, Oct 2019 (against the light).
  - [high] [walls, gardens, fences] `mly` Real right side is a tall stone gate pier with iron gate and a long wall; left has a plaster villa with balcony and Phoenix palm. Game has pale pavements and a huge pale paved lot on the right with bunting blocks.
  - [med] [street furniture, props, parked cars] `mly` Parked cars along the left kerb and utility poles with overhead wires missing.
  - [med] [facade style and colour] `mly` Real houses are 2 to 3 storey whitewashed villas; game left buildings are ochre blocks with coloured bunting squares and blue shutters.
- **mo25** (2024-04-24, 6 m, good): Via Pietro Calandra / A29 slip road, 7 m, Apr 2024.
  - [high] [road layout, width, markings] `mly` Real road at this point is a motorway-grade ramp towards the A19/A20 with steel crash barriers both sides, a green gantry sign (Palermo, Catania, Messina, Tommaso Natale, Mondello, Sferracavallo), a retaining wall with fence and a scrub embankment; game has a 2 lane road, a 4 m puddle decal and a pale paved slope.
  - [med] [terrain] `mly` The white paved slope on the right replaces a vegetated embankment with a retaining wall and a mesh fence.
- **mo26** (2019-10-05, 1 m, good): Via Rosario Nicoletti, 1 m, Oct 2019.
  - [high] [vegetation] `mly` A single huge spruce cone stands beside the road; real roadside is broadleaf trees, olive and bare dirt with a billboard and a 2 m rubble-and-concrete wall.
  - [med] [walls, gardens, fences] `mly` The long wall on the right (about 1.5 m high, ochre plaster) is missing; game has bollards and a pale paved walk.
  - [low] [road layout, width, markings] `mly` Real road is wide and fresh with solid edge lines; game has a dashed centre line and dashed edges with a lawn strip median.
- **mo28** (2019-10-05, 1 m, good): Via Rosario Nicoletti junction, 1 m, Oct 2019 (backlit).
  - [med] [pavements] `mly` Real junction has clean asphalt and a zebra crossing with kerbs; game has sand tint bands and a bare lawn triangle.
  - [low] [vegetation] `mly` Real island has shrubs and olive trees with a hedge; game has grass only.
  - [low] [street furniture, props, parked cars] `mly` Real has road signs on gantries, a billboard, parked cars on the right; game has piles of dumpsters.

### Monte Pellegrino, Favorita, Arenella, Acquasanta, Addaura (pellegrino)

Coverage is good on the Lungomare, Addaura and Arenella and absent on the climb itself above Via Bonanno's first bend and in the Favorita. The cliff wall of Pellegrino reads convincingly from the Lungomare (pe14, pe16, pe19). The street level around it lacks the walls, hedges, oleander and Aleppo pines that frame every real lane (pe19, pe21, pe23), parked cars, and in the Favorita the tree tunnel (pe32). Via Bonanno (pe06, pe08): missing parapet, wrong width, wrong rock at the hairpin; terrain heights are being reworked.

No coverage (24): pe01 pe02 pe03 pe04 pe05 pe07 pe09 pe10 pe11 pe12 pe17 pe18 pe20 pe24 pe25 pe26 pe27 pe28 pe30 pe33 pe34 pe35 pe36 pe37

| id | photo | d (m) | dh | match | findings h/m/l | main problems |
|---|---|---|---|---|---|---|
| pe06 | 2018-09-22 | 19 | 6 | good | 2/1/1 | vegetation, walls |
| pe08 | 2018-09-22 | 20 | 2 | good | 1/2/1 | terrain |
| pe13 | 2019-10-05 | 3 | 1 | good | 1/1/1 | walls |
| pe14 | 2019-10-05 | 4 | 1 | good | 2/0/1 | pavements, walls |
| pe15 | 2019-10-05 | 3 | 1 | good | 1/1/1 | walls |
| pe16 | 2019-10-05 | 7 | 5 | good | 1/2/1 | walls |
| pe19 | 2019-10-05 | 2 | 2 | good | 2/2/0 | vegetation, walls |
| pe21 | 2019-10-05 | 4 | 3 | good | 2/1/0 | street furniture, walls |
| pe22 | 2019-10-05 | 41 | 0 | partial | 1/1/0 | walls |
| pe23 | 2019-10-05 | 1 | 0 | good | 1/1/1 | walls |
| pe29 | 2019-10-05 | 2 | 1 | good | 1/2/1 | street furniture |
| pe31 | 2019-10-05 | 37 | 15 | partial | 2/1/0 | terrain, walls |
| pe32 | 2019-10-05 | 2 | 0 | good | 1/1/1 | vegetation |

Findings, by viewpoint (`mly`):

- **pe06** (2018-09-22, 19 m, good): Via Pietro Bonanno, 19 m, Sept 2018.
  - [high] [walls, gardens, fences] `mly` Real road has a continuous 0.8 m dry-stone parapet on the valley side and a rock cut with grass tufts on the other; game has neither, the road simply ends at a grass slope.
  - [high] [vegetation] `mly` Real slope is dry grass tufts, shrubs and a few Aleppo pines; game has 20 m tall spruce cones and a lime-green slope.
  - [med] [road layout, width, markings] `mly` Real road is about 6 m with a continuous white edge line on the left and a centre double line; game is 8 m with a short dashed line, pit decals and no edge line.
  - [low] [terrain] `mly` The panorama of the bay and Monte Catalfano is good in both.
- **pe08** (2018-09-22, 20 m, good): Via Pietro Bonanno hairpin, 20 m, Sept 2018.
  - [high] [terrain] `mly` Real hairpin runs under an overhanging ochre limestone cliff with rock outcrops and a grassy verge; game has pale grey sawtooth terrain wedges and a sandy cut with a stone texture of dark dots.
  - [med] [road hidden by terrain] `mly` Game road narrows to a ledge between spikes; real road is a continuous 6 m carriageway with a 0.5 m verge.
  - [med] [walls, gardens, fences] `mly` Real has a low dry-stone wall on the left and Ampelodesmos tufts; game has neither.
  - [low] [vegetation] `mly` No scrub or agave in the game; real has agave and tall grass at the foot of the cliff.
- **pe13** (2019-10-05, 3 m, good): Lungomare Cristoforo Colombo, 3 m, Oct 2019.
  - [high] [walls, gardens, fences] `mly` Real left side is hedge-covered garden walls with iron gates and villas; game has a wide pale pavement and blank ochre blocks.
  - [med] [vegetation] `mly` Real trees are street broadleaves (nettle tree / pistachio type) with dappled shade; game has ball trees, tall palms with sparse crowns.
  - [low] [street furniture, props, parked cars] `mly` Real has a yellow wheelie bin and parked cars; game has a parked car row on the right, which is good.
- **pe14** (2019-10-05, 4 m, good): Lungomare Cristoforo Colombo, 4 m, Oct 2019.
  - [high] [walls, gardens, fences] `mly` Real left is a plaster and brick wall with a decorative iron gate, bougainvillea and oleander above and a pine over the road; right side is a stone wall with fence along the sea. Game shows a sand band left and a huge pale paved slope on the right.
  - [high] [pavements] `mly` The pale paved slope at the foot of the cliff replaces the real rock face with scrub.
  - [low] [terrain] `mly` Limestone cliff is present in the game and reads convincingly.
- **pe15** (2019-10-05, 3 m, good): Lungomare Cristoforo Colombo, 3 m, Oct 2019 (backlit).
  - [high] [walls, gardens, fences] `mly` Real right side is a tall rubble stone retaining wall with a mesh fence; sea side has a steel crash barrier. Game has a sandy slope with spruce cones.
  - [med] [road layout, width, markings] `mly` Real road is cracked 2 lane asphalt with solid edge lines and a shoulder; game has a dashed centre line only.
  - [low] [coastline and sea] `mly` Real sea side has a barrier and rock shore with a tower in the distance; game hides it behind a bus.
- **pe16** (2019-10-05, 7 m, good): Lungomare Cristoforo Colombo at a signalised crossing, 7 m, Oct 2019.
  - [high] [walls, gardens, fences] `mly` Real right side is a white stone-clad garden wall topped by a clipped hedge and trees; game has a pale paved slope and bare ground.
  - [med] [street furniture, props, parked cars] `mly` Traffic lights on curved mast arms, zebra crossing with long white bars, pedestrian crossing sign missing in the game.
  - [med] [vegetation] `mly` Tall palms in game (good for the lungomare) but real foreground vegetation is dense evergreen hedge and pine; game has a lone spruce.
  - [low] [terrain] `mly` Cliff face at the right is a good match in shape.
- **pe19** (2019-10-05, 2 m, good): Via Annone, 2 m, Oct 2019.
  - [high] [walls, gardens, fences] `mly` Real lane is 4 to 5 m between an oleander hedge with grass verge (left) and a retaining wall with stairs (right), under tall Aleppo pines, with parked cars; game has an 8 m road, a white paved slab right and spruce cones.
  - [high] [vegetation] `mly` Oleander in flower and Aleppo pine umbrellas missing.
  - [med] [street furniture, props, parked cars] `mly` Parked Fiat 500X and a staircase entrance on the right missing.
  - [med] [road layout, width, markings] `mly` Road too wide by 3 m and with pit decals; real is worn with patches.
- **pe21** (2019-10-05, 4 m, good): Via Vergine Maria, 3 m, Oct 2019.
  - [high] [walls, gardens, fences] `mly` Real right side is a continuous 3 m masonry wall (long, stuccoed) with cypress behind; game has bollards and a pale pavement with garage-fronted blocks.
  - [high] [street furniture, props, parked cars] `mly` Cars parked bumper to bumper on both kerbs; game has none.
  - [med] [building heights and massing (coverage)] `mly` Real left side has low villas and a domed building, game has two plain 3 storey blocks.
- **pe22** (2019-10-05, 41 m, partial): Via Vergine Maria, 41 m, Oct 2019.
  - [high] [walls, gardens, fences] `mly` Same long tall wall and plane trees in the real photo; game shows sand bands, a pale pavement and an open dry field at the right.
  - [med] [street furniture, props, parked cars] `mly` Row of parked cars on both kerbs missing; dumpsters double-parked in game.
- **pe23** (2019-10-05, 1 m, good): Via Papa Sergio I, 1 m, Oct 2019.
  - [high] [walls, gardens, fences] `mly` Real right side is a 3 m ashlar stone wall with oleander and cypress behind, left has plaster walls and plane trees; game has a pale pavement and a shed with bunting.
  - [med] [vegetation] `mly` Mature street trees and oleander missing.
  - [low] [road layout, width, markings] `mly` Game road has a big pothole and sand-tinged edge; real asphalt is clean with a kerb and an edge ledge.
- **pe29** (2019-10-05, 2 m, good): Via Papa Sergio Primo, 2 m, Oct 2019.
  - [high] [street furniture, props, parked cars] `mly` Real street has cars parked along both kerbs, nose to tail; game has two dumpsters and an empty pavement.
  - [med] [walls, gardens, fences] `mly` Real right palazzina sits behind a wrought-iron fence on a stone plinth; game blocks stand directly on the pavement.
  - [med] [facade style and colour] `mly` Real buildings are yellow and ochre plaster with arched windows, deep balconies and green shutters; game are tan blocks with blue shutters and bunting on every storey.
  - [low] [building heights and massing (coverage)] `mly` Heights and street width are close to the real street.
- **pe31** (2019-10-05, 37 m, partial): Via Nostra Donna del Rotolo, 37 m, Oct 2019.
  - [high] [terrain] `mly` Real street frames the grey limestone wall of Monte Pellegrino at the end of the street; game vista is closed by buildings with no cliff backdrop.
  - [high] [walls, gardens, fences] `mly` Real right side is a low stone wall with a mesh fence and a reed thicket; left has fences and garden hedges. Game has blank walls with roller shutters right on the pavement.
  - [med] [road layout, width, markings] `mly` Real road is 9 to 10 m with kerbside parking and bins; game street is 5 m with a raised pavement on each side.
- **pe32** (2019-10-05, 2 m, good): Viale Diana, Favorita, 2 m, Oct 2019.
  - [high] [vegetation] `mly` Real avenue is a tunnel of mature broadleaf oaks and poplars with dry grass and orchard trees behind; game has lime lawn with spruce cones and an empty horizon.
  - [med] [road layout, width, markings] `mly` Real road has a solid white edge line on the left and a yellow one on the right, game has a pale kerb stripe only.
  - [low] [street furniture, props, parked cars] `mly` Real road has a Fiat Panda ahead, game has a white van (ok).

### Zisa, Noce, Uditore, Borgo Nuovo, Cruillas, Boccadifalco, Baida (zisa)

The arterial roads are the main story: Viale Regione Siciliana, Via Castellana and Viale Leonardo da Vinci have a tram line, iron railings, guard rails and tall lamp masts in reality and a bare sand median in the game (zi05 to zi07, zi15 to zi21). Viale Michelangelo and Via Giuseppe Pitre lack plane trees and parked cars. Via Roccazzo (zi28) and Via Umberto Maddalena (zi33) are walled lanes against an empty plain and a pale strip. zi10, zi11, zi40 and zi41 (stadium and Zisa castle) have no Mapillary coverage.

No coverage (26): zi01 zi02 zi03 zi04 zi10 zi11 zi12 zi13 zi14 zi22 zi23 zi24 zi25 zi26 zi27 zi29 zi30 zi32 zi34 zi35 zi36 zi37 zi38 zi39 zi40 zi41

| id | photo | d (m) | dh | match | findings h/m/l | main problems |
|---|---|---|---|---|---|---|
| zi05 | 2019-03-08 | 6 | 1 | good | 1/1/0 | street furniture |
| zi06 | 2019-03-08 | 7 | 8 | good | 0/3/1 | - |
| zi07 | 2019-03-24 | 2 | 2 | good | 1/1/1 | street furniture |
| zi08 | 2019-03-24 | 3 | 0 | good | 1/3/0 | vegetation |
| zi09 | 2019-03-24 | 5 | 1 | good | 2/1/0 | pavements, vegetation |
| zi15 | 2021-03-31 | 13 | 1 | good | 1/0/1 | road layout |
| zi16 | 2024-04-24 | 4 | 1 | good | 1/1/0 | road layout |
| zi17 | 2021-03-31 | 8 | 3 | good | 1/1/1 | road layout |
| zi18 | 2019-03-25 | 0 | 0 | good | 2/0/0 | pavements, road layout |
| zi19 | 2024-04-24 | 20 | 0 | partial | 1/0/1 | street furniture |
| zi20 | 2019-03-08 | 3 | 0 | good | 1/1/1 | street furniture |
| zi21 | 2019-03-24 | 8 | 16 | good | 2/0/1 | street furniture, vegetation |
| zi28 | 2019-03-12 | 5 | 2 | good | 3/0/0 | building heights and massing, vegetation, walls |
| zi31 | 2017-08-27 | 9 | 4 | good | 1/1/1 | street furniture |
| zi33 | 2019-03-24 | 3 | 1 | good | 1/2/0 | walls |

Findings, by viewpoint (`mly`):

- **zi05** (2019-03-08, 6 m, good): Viale Leonardo da Vinci, 7 m, Mar 2019.
  - [high] [street furniture, props, parked cars] `mly` Real avenue has a tram line behind a black iron railing with red overhead-wire poles, tram stop shelter, kerbside parking along the right and 12 storey balcony towers; game has an unmarked 4 lane road, a pale pavement on the left and ochre mid-rise.
  - [med] [road layout, width, markings] `mly` Pit decals 2 to 3 m wide on a road that is smooth in reality.
- **zi06** (2019-03-08, 7 m, good): Viale Leonardo da Vinci, 7 m, Mar 2019.
  - [med] [street furniture, props, parked cars] `mly` Real median carries a decorative black iron railing, a tram or trolley wire mast line and lamps; game has a bare edge.
  - [med] [vegetation] `mly` Real left and right have tall leafless plane trees and a fruit stand under an awning; game has lime lawn and sparse ball trees.
  - [med] [building heights and massing (coverage)] `mly` Real avenue is lined by continuous 8 to 10 storey apartment blocks (left); game has open ground with distant blocks.
  - [low] [terrain] `mly` Monte Grifone backdrop is accurate in shape.
- **zi07** (2019-03-24, 2 m, good): Viale Leonardo da Vinci, 2 m, Mar 2019.
  - [high] [street furniture, props, parked cars] `mly` Real central reservation carries a tram line with red overhead poles, a black iron railing, and a continuous parked-car row; game has an unmarked carriageway with a pale pavement.
  - [med] [building heights and massing (coverage)] `mly` Real left and right sides are 10 to 14 storey balcony towers in white, orange and brown; game has fewer, lower, ochre blocks and low sheds.
  - [low] [terrain] `mly` Monte Grifone peak at the end of the avenue is clearly visible in both; the game one is a good match.
- **zi08** (2019-03-24, 3 m, good): Viale Michelangelo, 3 m, Mar 2019.
  - [high] [vegetation] `mly` Real avenue has a double row of mature plane trees on both sides and a hedge strip; game has none.
  - [med] [street furniture, props, parked cars] `mly` Parked cars along the right kerb missing; real balconied blocks have continuous balcony fronts.
  - [med] [road layout, width, markings] `mly` Pit decals are 2 to 3 m wide; real surface is smooth with a small drain.
  - [med] [pavements] `mly` Game has 6 to 8 m pale pavement either side; real has kerb and 2 m pavements.
- **zi09** (2019-03-24, 5 m, good): Viale Michelangelo, 5 m, Mar 2019.
  - [high] [vegetation] `mly` Real roadside has plane trees, a stone pine and a palm; game has bare sand and tan paving.
  - [med] [walls, gardens, fences] `mly` Real right has a concrete panel wall with a gate; game has an open pale paved apron.
  - [high] [pavements] `mly` Game road sits on a 10 to 15 m wide tan band and blank pale apron; real asphalt runs straight to a kerb.
- **zi15** (2021-03-31, 13 m, good): Viale Regione Siciliana, 13 m, Mar 2021.
  - [high] [road layout, width, markings] `mly` Real is a 3 lane motorway-grade carriageway with continuous steel guard rails, solid white edge lines, tall lamp masts and a row of billboards; game has 2 lanes on a sand-coloured band with pits up to 3 m wide.
  - [low] [terrain] `mly` Mountain backdrop (Monte Billiemi / Pizzo Cane side) is close in shape but too smooth and pale green.
- **zi16** (2024-04-24, 4 m, good): Viale Regione Siciliana, 4 m, Apr 2024.
  - [high] [road layout, width, markings] `mly` Real is a 3 lane carriageway with solid edge lines, steel guard rails both sides, tufted scrub verges, motorway-style lamps, speed limit signs and a billboard; game has a median lawn (good) but a 2 lane road with a faint dash, no guard rail, no signs. Confirms survey finding 5.
  - [med] [vegetation] `mly` Verges are agave-like tufts and brush; game has lime lawn and spruce cones.
- **zi17** (2021-03-31, 8 m, good): Viale Regione Siciliana, 8 m, Mar 2021.
  - [high] [road layout, width, markings] `mly` Real is a curving expressway ramp with a guard rail, grass verge, a big stone pine and heavy truck traffic; game has a straight 2 lane road with a pale pavement on the right and no verge.
  - [med] [vegetation] `mly` Stone pine canopy and roadside shrubs missing; game has none in view.
  - [low] [building heights and massing (coverage)] `mly` Real left tower block (8 storey, cream) appears in the distance; game has similar blocks but ochre.
- **zi18** (2019-03-25, 0 m, good): Viale Regione Siciliana, 0 m, Mar 2019.
  - [high] [pavements] `mly` Real road is a 3 lane carriageway with a concrete retaining wall and railings on the right and tall blocks on the left; game puts the camera on a bare sand plain with no road mesh under it (road-hidden-by-terrain, known issue from the survey).
  - [high] [road layout, width, markings] `mly` The tram viaduct wall and guard rail are absent.
- **zi19** (2024-04-24, 20 m, partial): Viale Regione Siciliana, 20 m, Apr 2024.
  - [high] [street furniture, props, parked cars] `mly` Real central reservation carries a tram line with red overhead-wire poles, iron railings and signalled crossings; game has a wide sand-coloured median and a zebra crossing. The tram is a strong city identifier.
  - [low] [facade style and colour] `mly` Real near block is plain salmon plaster 5 storey; game blocks are tan with balcony strips (ok in massing).
- **zi20** (2019-03-08, 3 m, good): Via Castellana, 3 m, Mar 2019.
  - [high] [street furniture, props, parked cars] `mly` Real street is packed with cars parked double-deep on both sides, shop awnings and a tabacchi sign; game has an empty 4 lane road with pale pavements.
  - [med] [vegetation] `mly` Real left side has a dense wall of evergreen trees; game has a bare median strip.
  - [low] [building heights and massing (coverage)] `mly` Right block of 8 storeys is a good height match; real facade is pale cream with long balconies, game is tan.
- **zi21** (2019-03-24, 8 m, good): Via Castellana, 8 m, Mar 2019.
  - [high] [street furniture, props, parked cars] `mly` Real left side is a tram line with iron fence and red poles; right has a white noise barrier on a concrete wall, a big ficus overhanging the road and a cracked pavement. Game has a wide sand band and a 4 m puddle decal.
  - [high] [vegetation] `mly` Giant ficus canopy over the road is missing.
  - [low] [terrain] `mly` Monte Billiemi silhouette in the real photo is steeper and darker.
- **zi28** (2019-03-12, 5 m, good): Via Roccazzo, 5 m, Mar 2019.
  - [high] [walls, gardens, fences] `mly` Real lane runs between iron-railed walls and a green mesh fence with a stone-and-concrete gate pier, under eucalyptus and holm oak; game is a flat road across a bare ochre plain with a row of parked cars on the horizon.
  - [high] [vegetation] `mly` Eucalyptus avenue and shrubs missing.
  - [high] [building heights and massing (coverage)] `mly` Real road has fenced gardens and villas on both sides; game has empty ground (missing buildings and land use).
- **zi31** (2017-08-27, 9 m, good): Via Giuseppe Pitre, 9 m, Aug 2017.
  - [high] [street furniture, props, parked cars] `mly` Real street has cars parked bumper to bumper on both kerbs; game has none.
  - [med] [vegetation] `mly` Real has a broadleaf tree over the right kerb and balcony plants; game has no trees.
  - [low] [facade style and colour] `mly` Real facades are cream and brown plaster with wrought-iron balcony railings and awnings; game blocks have bunting and teal balconies.
- **zi33** (2019-03-24, 3 m, good): Via Umberto Maddalena, 3 m, Mar 2019.
  - [high] [walls, gardens, fences] `mly` Real right side is a 3 m precast concrete wall with a rusty spiked fence on top, left is a scrub embankment with broom and shrubs. Game has the embankment (good) but a pale paved strip and a tall lamp pole instead of the wall.
  - [med] [vegetation] `mly` Scrub and broom on the embankment is missing: grass only.
  - [med] [road layout, width, markings] `mly` Pit decals are 2 m wide; real surface is smooth with a rumble strip.

### Oreto, Stazione, Corso dei Mille, Brancaccio, Romagnolo, Ciaculli, Villagrazia (sud)

Best coverage (29 of 46). Via Oreto, Via Salvatore Corleone and Via Giovanni Di Stefano confirm the empty-plain finding: the real streets are built up, with stalls, hoardings, an elevated viaduct and a roundabout garden. The SS113 Sud Est and Viale Regione Siciliana Sud Est are tree-lined expressways with guard rails in reality. Falsomiele and Ciaculli (su19, su24) show walled lanes under steep limestone and olive terraces, none of which exists in the game. The residential streets (su05, su06, su11, su42, su43) match in massing but have no parked cars, balcony life or kerbs.

No coverage (17): su03 su14 su15 su20 su21 su22 su23 su25 su28 su30 su31 su32 su33 su35 su36 su40 su46

| id | photo | d (m) | dh | match | findings h/m/l | main problems |
|---|---|---|---|---|---|---|
| su01 | 2021-04-15 | 4 | 31 | partial | 1/1/0 | street furniture |
| su02 | 2026-04-01 | 5 | 3 | good | 1/2/0 | building heights and massing |
| su04 | 2021-05-30 | 6 | 3 | good | 1/1/1 | street furniture |
| su05 | 2021-03-23 | 6 | 16 | good | 1/1/1 | street furniture |
| su06 | 2021-03-16 | 4 | 0 | good | 1/2/0 | street furniture |
| su07 | 2021-03-04 | 5 | 1 | good | 1/2/0 | street furniture |
| su08 | 2026-04-01 | 5 | 1 | good | 1/1/1 | vegetation |
| su09 | 2026-09-27 | 15 | pano | good | 2/0/0 | road layout, vegetation |
| su10 | 2026-04-01 | 6 | 2 | good | 1/1/0 | road layout |
| su11 | 2019-03-08 | 11 | 0 | good | 1/1/1 | street furniture |
| su12 | 2018-02-15 | 6 | 6 | good | 1/2/0 | street furniture |
| su13 | 2021-03-30 | 5 | 1 | good | 1/2/0 | vegetation |
| su16 | 2017-09-23 | 24 | 5 | good | 1/1/1 | pavements |
| su17 | 2019-03-13 | 2 | 3 | good | 3/0/0 | pavements, vegetation, walls |
| su18 | 2019-03-13 | 1 | 0 | good | 2/1/0 | building heights and massing, vegetation |
| su19 | 2019-03-10 | 6 | 1 | good | 2/1/0 | terrain, walls |
| su24 | 2019-03-10 | 10 | 7 | partial | 2/0/0 | building heights and massing, walls |
| su26 | 2018-09-22 | 1 | 4 | good | 2/0/0 | building heights and massing, road layout |
| su27 | 2021-03-24 | 3 | 1 | good | 0/2/0 | - |
| su29 | 2018-02-10 | 5 | 0 | good | 1/1/0 | road layout |
| su34 | 2021-03-11 | 3 | 5 | good | 1/1/1 | walls |
| su37 | 2026-09-27 | 27 | pano | partial | 0/2/0 | - |
| su38 | 2019-03-08 | 3 | 3 | good | 1/1/0 | walls |
| su39 | 2026-04-01 | 1 | 2 | good | 1/1/0 | walls |
| su41 | 2021-03-04 | 3 | 0 | good | 1/1/0 | walls |
| su42 | 2018-09-22 | 3 | 1 | good | 0/1/3 | - |
| su43 | 2021-03-12 | 6 | 0 | good | 1/2/0 | street furniture |
| su44 | 2021-03-29 | 9 | 0 | good | 2/0/1 | building heights and massing, walls |
| su45 | 2021-03-12 | 2 | 1 | good | 1/1/0 | vegetation |

Findings, by viewpoint (`mly`):

- **su01** (2021-04-15, 4 m, partial): Via Oreto, 5 m, Apr 2021; photo is motion-blurred and 31 degrees off heading.
  - [high] [street furniture, props, parked cars] `mly` Real street is a busy shopping street with parked scooters, cars both sides and shop signs in red and yellow; game is a quiet canyon of two ochre slabs.
  - [med] [facade style and colour] `mly` Real facades have deep balconies, awnings and shop fronts; game blocks are windowless ochre slabs.
- **su02** (2026-04-01, 5 m, good): Via Oreto, 5 m, Apr 2026 (newest photo).
  - [high] [building heights and massing (coverage)] `mly` Real junction is a busy street with market stalls under white awnings, 5 to 8 storey blocks on both sides and a flyover rail; game has a tan open plain with scattered blocks and dumpsters. Confirms the Via Oreto empty-plain finding.
  - [med] [pavements] `mly` Game has a large sand band left of the road and a dark rectangular patch right; real has kerbs and pavements.
  - [med] [street furniture, props, parked cars] `mly` Billboards, lamp posts with double arms, market stalls and heavy traffic missing.
- **su04** (2021-05-30, 6 m, good): Corso dei Mille, 7 m, May 2021.
  - [high] [street furniture, props, parked cars] `mly` Real central reservation has a tram line with red overhead poles and decorative iron railings, signalled crossing; game has a sand patch on the left and a pale pavement on the right.
  - [med] [facade style and colour] `mly` Real right-hand buildings are 19th century palazzi with iron balconies, shutters and a palm on a terrace; game shows plain ochre blocks with ribbed fronts.
  - [low] [building heights and massing (coverage)] `mly` Overall street width and block height are close.
- **su05** (2021-03-23, 6 m, good): Corso dei Mille side, 6 m, Mar 2021, 16 degrees off.
  - [high] [street furniture, props, parked cars] `mly` Cars parked along both kerbs, shop awnings and a person at the kerb; game has none, only an empty road.
  - [med] [facade style and colour] `mly` Real palazzine are terracotta-coloured with wrought iron balconies and flowerpots; game has similar colour but a monotone arcade of identical shopfronts at street level.
  - [low] [road layout, width, markings] `mly` Real road surface is patched and rough; game is smoother with decals (closer than most).
- **su06** (2021-03-16, 4 m, good): Corso dei Mille side street, 4 m, Mar 2021.
  - [high] [street furniture, props, parked cars] `mly` Real street has cars parked on both kerbs, a dumpster, shop shutters and laundry hung on balconies; game has none of these.
  - [med] [facade style and colour] `mly` Real facades have deep balconies, awnings and varied plaster; game blocks are plain 3 storey boxes with identical windows.
  - [med] [pavements] `mly` A flat tan rectangle lies across the carriageway in the game (terrain tint showing through the road).
- **su07** (2021-03-04, 5 m, good): Viale Regione Siciliana Sud Est, 5 m, Mar 2021.
  - [high] [street furniture, props, parked cars] `mly` Real roadside has an IP petrol station with canopy and price sign, billboards and arching lamp posts, a steel guard rail and a stone pine; game has a lawn strip, one palm and an office block.
  - [med] [vegetation] `mly` Stone pine umbrellas and roadside scrub missing; game has one fat palm and ball trees.
  - [med] [pavements] `mly` Game sand band left and pale apron right; real has dirt shoulder with litter and a guard rail (so dirt IS present, but with a rail and kerb).
- **su08** (2026-04-01, 5 m, good): SS113 / Viale Regione Siciliana Sud Est, 5 m, Apr 2026.
  - [high] [vegetation] `mly` Real road runs under a continuous tunnel of stone pines (umbrella crowns, 15 m) next to a steel guard rail; game has two sand bands and bare ground with tower blocks.
  - [med] [road layout, width, markings] `mly` Guard rail, kerbs and edge lines missing; the road is a 3 lane carriageway in reality.
  - [low] [terrain] `mly` Mountain backdrop is a fair match.
- **su09** (2026-09-27, 15 m, good): Viale Regione Siciliana Sud Est (pano), 15 m, Sept 2026 (newest photo of all).
  - [high] [vegetation] `mly` Real road has a long row of stone pines and palms on a planted median with a steel guard rail and billboards; game has sand bands and a black car.
  - [high] [road layout, width, markings] `mly` Median with guard rail and lamp posts missing; game has a flat single carriageway.
- **su10** (2026-04-01, 6 m, good): Viale Regione Siciliana Sud Est (elevated section), 6 m, Apr 2026.
  - [high] [road layout, width, markings] `mly` Real is a raised expressway with double steel guard rails, mesh fence and tall twin-arm lamps next to a rock cut; game has a 2 lane road with sand verge and a white paved slope.
  - [med] [walls, gardens, fences] `mly` Retaining cut with mesh fence missing, replaced by a pale paving slope.
- **su11** (2019-03-08, 11 m, good): Via Lenin Mancuso, 11 m, Mar 2019.
  - [high] [street furniture, props, parked cars] `mly` Real street has cars parked nose to tail on both kerbs and a central strip with shrubs; game has a floating white car and a sand verge.
  - [low] [building heights and massing (coverage)] `mly` Brown 12 storey balconied tower on the right and the mountain backdrop match well; real balconies have plants and awnings.
  - [med] [pavements] `mly` Game has sand-coloured bands and a wide pale pavement.
- **su12** (2018-02-15, 6 m, good): Via Pio La Torre, 6 m, Feb 2018.
  - [high] [street furniture, props, parked cars] `mly` Real side street has cars parked along both kerbs and graffiti-covered wheelie bins; game has one car, one dumpster and a bare sand verge.
  - [med] [vegetation] `mly` Mature street trees (planes and ficus) on the left missing.
  - [med] [building heights and massing (coverage)] `mly` Real 12 storey slab with coloured balcony strips is a landmark of this district; game blocks are 5 to 6 storey ochre.
- **su13** (2021-03-30, 5 m, good): Via Ernesto Basile, 5 m, Mar 2021.
  - [high] [vegetation] `mly` Real avenue has a long row of pollarded plane trees on both kerbs; game has none.
  - [med] [street furniture, props, parked cars] `mly` Real kerb has a bank of wheelie bins, a large billboard and a petrol station; game has a white car and a bare pale apron with a tan band.
  - [med] [pavements] `mly` Game has an 8 m tan band on the left and a rectangular dark patch on the road.
- **su16** (2017-09-23, 24 m, good): Via Villagrazia, 24 m, Sept 2017.
  - [high] [pavements] `mly` Real junction is clean asphalt with kerbs and recycling bins; game has a tan terrain plain with big pit decals where the road should be.
  - [med] [street furniture, props, parked cars] `mly` Row of yellow recycling bins, stone pine, oleander and signs missing.
  - [low] [facade style and colour] `mly` Real orange-ochre blocks with balcony columns are a good colour match to the game's ochre.
- **su17** (2019-03-13, 2 m, good): Via Palmerino, 2 m, Mar 2019.
  - [high] [walls, gardens, fences] `mly` Real lane runs beside a 2 m concrete wall with a plaque, reeds, stone pines and cypresses; game has a huge pale slab plaza and tall blocks.
  - [high] [vegetation] `mly` Reeds, pines and cypress missing.
  - [high] [pavements] `mly` Game has 20 m of pale paving beside a 6 m road; real is a lane with a walled edge.
- **su18** (2019-03-13, 1 m, good): Via Filippo Paruta, 1 m, Mar 2019.
  - [high] [vegetation] `mly` Real street is an avenue of broadleaf trees with a canopy over the road and recycling bins; game is an empty sand and paving plain with distant blocks.
  - [med] [street furniture, props, parked cars] `mly` Cars parked on both kerbs and bins missing; game has a white box car and sparse traffic.
  - [high] [building heights and massing (coverage)] `mly` Real street is enclosed by houses and walls; game has open ground.
- **su19** (2019-03-10, 6 m, good): Via Falsomiele, 6 m, Mar 2019.
  - [high] [walls, gardens, fences] `mly` Real lane is a 3.5 m strip between a whitewashed rubble wall (left) and a dry-stone terrace wall topped with hedge and olive trees (right), under a rock massif; game has a wide strip across bare ochre ground.
  - [high] [terrain] `mly` Real mountain is a steep grey limestone face with green scrub terraces; game slope is a smooth beige mound with a few pines.
  - [med] [vegetation] `mly` Olive trees, hedges and terraces missing.
- **su24** (2019-03-10, 10 m, partial): Via Ciaculli junction, 10 m, Mar 2019.
  - [high] [building heights and massing (coverage)] `mly` Real junction is a rural village edge with 1 to 2 storey houses behind rubble and plaster walls, a Norfolk pine and the limestone ridge beyond; game has 6 storey apartment blocks with shutters and bunting and an urban canyon.
  - [high] [walls, gardens, fences] `mly` Whitewashed and rubble garden walls, an iron gate and road signs missing.
- **su26** (2018-09-22, 1 m, good): Via Salvatore Corleone roundabout, 1 m, Sept 2018.
  - [high] [road layout, width, markings] `mly` Real is a landscaped roundabout with kerbed island, shrubs, give-way and roundabout signs, a long line of lamp posts and a pylon; game is a flat tan plain with a 2 lane road, tricycle taxis and dumpsters.
  - [high] [building heights and massing (coverage)] `mly` Real horizon has a fenced industrial yard, tank, and a railway embankment with overhead wires; game has distant low blocks only. Confirms the tan-plain finding for Salvatore Corleone.
- **su27** (2021-03-24, 3 m, good): Via Filippo Pecoraino roundabout, 3 m, Mar 2021.
  - [med] [vegetation] `mly` Real roundabout island has date palms and a pine grove; game has a grass island with ball trees and a spruce, closer than average.
  - [med] [street furniture, props, parked cars] `mly` Real has a lorry, a kerb with a drainage channel and traffic signs; game has a dumpster on the island.
- **su29** (2018-02-10, 5 m, good): Via Giovanni Di Stefano, 5 m, Feb 2018.
  - [high] [road layout, width, markings] `mly` Real is an elevated viaduct with concrete parapet, lamp posts and trucks; game is a road across a flat tan plain with no parapet. The elevated section is missing.
  - [med] [building heights and massing (coverage)] `mly` Real horizon has industrial chimneys and a port skyline.
- **su34** (2021-03-11, 3 m, good): Via Belmonte Chiavelli, 3 m, Mar 2021.
  - [high] [walls, gardens, fences] `mly` Real lane is hemmed by a 4 m rough ashlar wall on the right with weeds and a plastered farmhouse with tiled eaves on the left; game has two flat-roofed boxes with garage shutters and pale pavements.
  - [med] [facade style and colour] `mly` Real terracotta plaster with a pitched tile roof and arch doorway; game boxes have flat roofs and cartoon brick patches.
  - [low] [road layout, width, markings] `mly` Real lane is 4 m and smooth; game is 7 m with pit decals.
- **su37** (2026-09-27, 27 m, partial): Via Altofonte (pano), 27 m, Sept 2026.
  - [med] [facade style and colour] `mly` Real houses are low yellow and ochre villini with balcony railings and parked cars in a village street; game has a 5 storey block with bunting and a 4 m pothole.
  - [med] [road layout, width, markings] `mly` The 4 m wide pit decal in the foreground is out of scale with the road.
- **su38** (2019-03-08, 3 m, good): Via Altofonte, 3 m, Mar 2019.
  - [high] [walls, gardens, fences] `mly` Real lane has 2 m plastered garden walls with gates and a row of parked cars under trees; game has a wide road, a pale paved square with a bus stop and three bunting blocks.
  - [med] [vegetation] `mly` Mature trees missing.
- **su39** (2026-04-01, 1 m, good): Via Gustavo Roccella, 1 m, Apr 2026.
  - [high] [walls, gardens, fences] `mly` Real left side is a long rubble stone wall with a wrought-iron fence and a stone pine; game has a pale plaza with a dull block. Walls and garden missing.
  - [med] [street furniture, props, parked cars] `mly` Parked cars, a pine and utility wires missing.
- **su41** (2021-03-04, 3 m, good): Via Papa Giovanni Paolo II, 3 m, Mar 2021.
  - [high] [walls, gardens, fences] `mly` Real left side is a 2 m orange works hoarding and a wall with an iron gate; right has cars parked at the kerb; game has a lawn and a pale pavement.
  - [med] [vegetation] `mly` Game has bright lime lawn on the right, real has none.
- **su42** (2018-09-22, 3 m, good): Via Messina Marine, 3 m, Sept 2018 (good structural match).
  - [med] [street furniture, props, parked cars] `mly` Real street has dumpsters overflowing at the kerb, double-parked cars and shop signs; game is clean with a white van and a bare pavement.
  - [low] [vegetation] `mly` Real has big date palms on the right; game has a lamp post and nothing planted.
  - [low] [coastline and sea] `mly` Game shows the sea at the end of the road on the right, which real hides behind buildings, but the sea-side layout is plausible.
  - [low] [facade style and colour] `mly` Real fronts are pink and ochre with deep balconies and a modern cafe sign; game has a tan block with orange awnings.
- **su43** (2021-03-12, 6 m, good): Via Messina Marine, 6 m, Mar 2021.
  - [high] [street furniture, props, parked cars] `mly` Real street has cars on both kerbs, a stepped brick pavement and balcony plants; game has an unbroken tan pavement and two empty facades.
  - [med] [facade style and colour] `mly` Real left blocks are ochre villini with decorated balconies and a yellow tower; game has two 4 storey long slabs with a repeated window grid.
  - [med] [pavements] `mly` Game pavement is a 10 m pale apron.
- **su44** (2021-03-29, 9 m, good): Via Messina Marine, 9 m, Mar 2021.
  - [high] [walls, gardens, fences] `mly` Real road runs between a ruined ashlar farmhouse wall (right) and a guard rail with dense Mediterranean trees (left); game is a flat road through a tan plain with a lone dumpster.
  - [high] [building heights and massing (coverage)] `mly` Real tall rough-cut stone ruin and tree canopy missing; confirms the south coast plain finding.
  - [low] [coastline and sea] `mly` The game shows the sea at the right horizon, which real hides behind vegetation.
- **su45** (2021-03-12, 2 m, good): Via Giulio Natta, 2 m, Mar 2021.
  - [high] [vegetation] `mly` Real roadside has eucalyptus, birches and bamboo; game has bare ochre ground with sparse traffic.
  - [med] [road layout, width, markings] `mly` Real road is rough asphalt with a kerb and a roundabout apron; game has a dashed line and a 4 m puddle.

### Port, Foro Italico, Cala, Kalsa (porto)

Foro Italico (pt01 to pt05) is confirmed as the worst seafront stretch: tan dirt strips, ball trees and spruce instead of palm avenue and balustrade. Gates (Porta Felice, Porta dei Greci) are missing at its ends (WIP). Via della Cala and Via Imperatore Federico (pt06 to pt11) lack parked cars, trees and kerbs; Piazza Tredici Vittime (pt14) lacks the flyover. The port wall tags (pt09, pt15) show SUCA/800A tags (WIP).

No coverage (15): pt13 pt16 pt17 pt18 pt20 pt21 pt22 pt23 pt25 pt27 pt28 pt29 pt30 pt31 pt32

| id | photo | d (m) | dh | match | findings h/m/l | main problems |
|---|---|---|---|---|---|---|
| pt01 | 2021-05-30 | 2 | 1 | good | 1/3/0 | vegetation |
| pt02 | 2021-05-30 | 17 | 15 | partial | 1/2/0 | landmarks |
| pt03 | 2021-05-30 | 4 | 3 | good | 2/1/0 | pavements, vegetation |
| pt04 | 2021-05-30 | 2 | 4 | good | 2/1/0 | coastline and sea, vegetation |
| pt05 | 2021-03-30 | 2 | 1 | good | 0/3/0 | - |
| pt06 | 2021-05-30 | 4 | 7 | good | 0/2/1 | - |
| pt07 | 2021-05-30 | 2 | 0 | good | 0/2/1 | - |
| pt08 | 2021-05-30 | 6 | 7 | good | 0/3/0 | - |
| pt09 | 2024-04-11 | 31 | 0 | partial | 0/0/3 | - |
| pt10 | 2018-11-04 | 4 | 4 | good | 2/0/1 | street furniture, vegetation |
| pt11 | 2018-11-04 | 10 | 5 | good | 2/1/0 | pavements, street furniture |
| pt12 | 2014-06-02 | 14 | 3 | good | 2/2/0 | street furniture, vegetation |
| pt14 | 2021-05-30 | 42 | 43 | partial | 1/1/0 | road hidden by terrain |
| pt15 | 2018-02-18 | 43 | 5 | partial | 0/2/1 | - |
| pt19 | 2021-05-30 | 36 | 2 | partial | 1/2/1 | vegetation |
| pt24 | 2022-04-19 | 23 | 0 | partial | 1/1/0 | facade style and colour |
| pt26 | 2021-03-30 | 3 | 4 | good | 0/2/1 | - |
| pt33 | 2021-08-28 | 41 | 7 | poor | 0/0/1 | - |

Findings, by viewpoint (`mly`):

- **pt01** (2021-05-30, 2 m, good): Foro Italico, 2 m, May 2021.
  - [high] [vegetation] `mly` Real seafront has tall Washingtonia and Phoenix palms and big clipped pittosporum hedges; game has faceted ball trees on tan dirt bands and no palms.
  - [med] [coastline and sea] `mly` Foro Italico is an ordinary 3 lane road with kerbs, bollards and a low wall in the real photo; game road is 8 m on a 20 m tan dirt strip. No sea wall or balustrade in view.
  - [med] [landmarks] `mly` Real view shows Monte Pellegrino and the Porta Felice side building at the end of the road; game shows only a flat green and a pale sheet.
  - [med] [street furniture, props, parked cars] `mly` Real road is full of traffic, scooters and street lamps in curved arms; game road is empty.
- **pt02** (2021-05-30, 17 m, partial): Foro Italico towards the Porta dei Greci, 17 m, May 2021.
  - [high] [landmarks] `mly` Real view ends at a neoclassical colonnaded gateway with a lion-topped pediment (Porta dei Greci) behind palms; game shows a plain arcaded block among ball trees (gate being worked on by another agent).
  - [med] [vegetation] `mly` Washingtonia palm and clipped oleander hedges at the left in the real photo; game has one fat palm and broad ball trees.
  - [med] [street furniture, props, parked cars] `mly` Row of parked cars along the right kerb missing; real road has a worn surface and pedestrian crossing signs.
- **pt03** (2021-05-30, 4 m, good): Foro Italico, 4 m, May 2021.
  - [high] [vegetation] `mly` Date palms in groups, shrubs and a stand of pines are replaced by spruce cones and ball trees.
  - [high] [pavements] `mly` Game road sits on 15 m sand bands left and right; real road has a kerb and pavement with a stall and signs.
  - [med] [street furniture, props, parked cars] `mly` Real roadside has a barbecue stall, parked cars, parking sign and lamp posts; game has dumpsters.
- **pt04** (2021-05-30, 2 m, good): Foro Italico, 2 m, May 2021.
  - [high] [vegetation] `mly` Real left has a fence with orange netting (works) and tall Washingtonia palms plus a stone balustrade on the right; game has ball trees and spruce cones on tan ground.
  - [high] [coastline and sea] `mly` No balustrade or sea wall in the game; the real right side has a stone balustrade with posts.
  - [med] [road layout, width, markings] `mly` Zebra stripes and skid pairs are drawn wrongly (white blocks read as a smudged word, black skid pair crossing the whole lane).
- **pt05** (2021-03-30, 2 m, good): Foro Italico, 2 m, Mar 2021.
  - [med] [road layout, width, markings] `mly` Real crossing has 8 wide stripes and the street has yellow hatching; game stripes are broken and half-missing, with skid pairs and a long black rectangle.
  - [med] [vegetation] `mly` Real left palms and a bare plane tree; the game has a few palms in the distance but fat ball trees in the foreground.
  - [med] [walls, gardens, fences] `mly` Real right side is a white painted wall with a railing (garden wall of an old villa); game shows a lawn and an ochre office block.
- **pt06** (2021-05-30, 4 m, good): Via della Cala, 4 m, May 2021.
  - [med] [pavements] `mly` Game has a 10 m pale paved apron on the left with a tall lamp pole and tan bands on the right; real has a kerb with a flower bed, parked cars and a pavement.
  - [med] [vegetation] `mly` Real has umbrella stone pines and clipped shrubs; game has none.
  - [low] [street furniture, props, parked cars] `mly` Roadworks sign, parked cars missing.
- **pt07** (2021-05-30, 2 m, good): Via della Cala, 1 m, May 2021.
  - [med] [street furniture, props, parked cars] `mly` Real street has a works hoarding of orange mesh and portable toilet, a billboard, parked cars; game is tidy.
  - [med] [vegetation] `mly` Palm garden on the right is replaced by lawn with ball trees.
  - [low] [facade style and colour] `mly` Real left block is 7 storey cream with balconies; game block is 6 storey tan with arched shopfronts (massing ok).
- **pt08** (2021-05-30, 6 m, good): Via della Cala, 5 m, May 2021.
  - [med] [vegetation] `mly` Real road is lined by palms and a row of traffic lights, with a bike lane marking; game has a few palms but mostly ball trees.
  - [med] [pavements] `mly` Game has 6 m of pale paving left and a 7 m grey pavement right, real has a bike lane with white edge lines and parked cars.
  - [med] [street furniture, props, parked cars] `mly` Parked cars on both sides missing; scaffolded corner building on the right is missing.
- **pt09** (2024-04-11, 31 m, partial): Port waterfront near Via Crispi, 31 m, Apr 2024.
  - [low] [pavements] `mly` Real area is a brick-paved esplanade with a grass strip, bollard lamps, a palm and a car park; game has pale slab paving and a bare strip.
  - [low] [street furniture, props, parked cars] `mly` Real has parked scooters, bins, slim post lamps with cameras; game has SUCA wall tags on a warehouse (SUCA tags being worked on).
  - [low] [landmarks] `mly` Mountain backdrop (Monte Pellegrino with the sanctuary) appears in both.
- **pt10** (2018-11-04, 4 m, good): Via Imperatore Federico, 4 m, Nov 2018.
  - [high] [vegetation] `mly` Real street is shaded by big plane and ficus trees with a row of cars parked along the blue-lined kerb; game has a yellow bus (good local detail) and spruce cones.
  - [high] [street furniture, props, parked cars] `mly` Parked cars and bay lines missing, a yellow bus fills the foreground.
  - [low] [building heights and massing (coverage)] `mly` Balconied residential blocks 8 to 10 storey match well.
- **pt11** (2018-11-04, 10 m, good): Via Imperatore Federico, 10 m, Nov 2018.
  - [high] [pavements] `mly` Game puts the camera on a 20 m wide pale plaza with a thin asphalt strip, where the real street has kerbs, blue bays and cars both sides.
  - [med] [vegetation] `mly` Big ficus overhanging the right kerb missing.
  - [high] [street furniture, props, parked cars] `mly` Cars parked on both sides missing.
- **pt12** (2014-06-02, 14 m, good): Via Domenico Costantino area, 14 m, June 2014.
  - [high] [vegetation] `mly` Real street is shaded by a huge ficus canopy overhanging a stone garden wall; game has no trees and a lawn at the end.
  - [high] [street furniture, props, parked cars] `mly` Cars are parked on both kerbs in the real street, with blue bay lines; game has an empty road.
  - [med] [pavements] `mly` Game has 5 m pale pavements either side; real has 1.5 m pavement strips and parked cars against the kerb.
  - [med] [facade style and colour] `mly` Real palazzine are pale pink and cream with iron balconies and flower pots and 4 storeys; game has 6 storey tan slabs with continuous balcony ledges and dark shopfronts.
- **pt14** (2021-05-30, 42 m, partial): Piazza Tredici Vittime, 42 m, May 2021; photo is taken in an underpass below a curved viaduct.
  - [high] [road hidden by terrain] `mly` Real roadway dips under a concrete flyover with retaining walls and a bike barrier; the game has a flat grass park with spruce cones and a single palm at the same spot. The viaduct and cutting are absent.
  - [med] [vegetation] `mly` Lime lawn with spruce cones; the real square has paved ground and few trees.
- **pt15** (2018-02-18, 43 m, partial): Via Emerico Amari towards the sea, 43 m, Feb 2018.
  - [med] [building heights and massing (coverage)] `mly` Real left side has a long iron fence with weeds and a 5 storey old palazzo with arched windows in worn cream; game has an empty lawn, a 2 storey brick building and a small hut with a SUCA/800A tag (tags being worked on).
  - [low] [pavements] `mly` Game shows a pale paved piazza and a thin asphalt strip; real is a 3 lane road with kerbs.
  - [med] [street furniture, props, parked cars] `mly` Billboard, lamps, parked cars missing.
- **pt19** (2021-05-30, 36 m, partial): Foro Italico end near Porta Felice, 36 m, May 2021.
  - [high] [vegetation] `mly` Real has tall Washingtonia palms, flowering oleander and a big ficus along a parking-lined seafront road; game has a stone piazza with a lawn and ball trees.
  - [med] [street furniture, props, parked cars] `mly` Rows of cars parked along the right kerb and traffic signs missing; game has an esplanade with ornate post lamps (good) but nothing at the kerb.
  - [med] [landmarks] `mly` Porta Felice gate at the far end of the real road is not in view in the game (gates being worked on by another agent).
  - [low] [building heights and massing (coverage)] `mly` Curved palazzo block on the right in the game is plausible (Cassaro end).
- **pt24** (2022-04-19, 23 m, partial): Via Giuseppe Giusti, 23 m, Apr 2022.
  - [high] [facade style and colour] `mly` Real left building is a 1950s concrete block with a deep pilotis arcade, shuttered balconies and shops (a tabacchi, a gold buyer); game shows a baroque-style palazzo with iron balconies and roller shutters.
  - [med] [road layout, width, markings] `mly` Real road runs beside a guard-railed cutting with roadworks and cars parked in a tight line; game road is wide with pit decals and a pale pavement.
- **pt26** (2021-03-30, 3 m, good): Corso Tukory, 3 m, Mar 2021.
  - [med] [vegetation] `mly` Real left side has two big broadleaf street trees and bare planes; game has none near the road.
  - [med] [street furniture, props, parked cars] `mly` Real street has parked cars both sides, a petrol station at the junction, a long zebra crossing; game has one white box car, one dumpster and a lozenge decal.
  - [low] [building heights and massing (coverage)] `mly` Palazzi on both sides are 5 to 6 storey in reality with deep iron balconies; game heights and street width are close.
- **pt33** (2021-08-28, 41 m, poor): Via Tiro a Segno, 41 m, Aug 2021; the photo stands inside a garden under pines and an ivy-covered viaduct wall, the game stands on a street, not comparable.
  - [low] [vegetation] `mly` Real garden has stone pines, tamarisk and ivy; game street has a lawn strip with no trees.

### Stadium, landmarks, avenues (landmarks)

Mostly avenues and ring roads: the A29 link and Circonvallazione (lm19 to lm24) are motorways in reality; lm01, lm14, lm18, lm26 show the missing trees, parked cars and billboards. No Mapillary coverage exists for the stadium front, Zisa, Cuba Sottana (the photo looks at a wall), Palazzina Cinese and most monuments (lm02 to lm17, lm25 to lm29 apart from those listed), so the survey's `mem` landmark findings could not be checked.

No coverage (17): lm02 lm03 lm04 lm05 lm07 lm08 lm10 lm11 lm12 lm13 lm15 lm16 lm17 lm25 lm27 lm28 lm29

| id | photo | d (m) | dh | match | findings h/m/l | main problems |
|---|---|---|---|---|---|---|
| lm01 | 2017-04-14 | 12 | 2 | partial | 1/1/1 | vegetation |
| lm06 | 2021-04-10 | 3 | 37 | poor | 0/1/1 | - |
| lm09 | 2019-03-25 | 23 | 1 | good | 0/2/1 | - |
| lm14 | 2017-08-27 | 14 | 9 | good | 1/2/0 | vegetation |
| lm18 | 2018-09-22 | 6 | 2 | good | 1/2/0 | building heights and massing |
| lm19 | 2021-03-31 | 6 | 2 | good | 1/1/1 | road layout |
| lm20 | 2024-04-24 | 6 | 1 | good | 1/0/1 | road layout |
| lm21 | 2024-04-24 | 4 | 2 | good | 1/1/0 | road layout |
| lm22 | 2024-04-24 | 6 | 1 | good | 1/0/1 | road layout |
| lm23 | 2017-09-27 | 3 | 8 | good | 1/1/0 | road layout |
| lm24 | 2024-04-24 | 4 | 4 | good | 1/2/0 | street furniture |
| lm26 | 2018-09-22 | 3 | 3 | good | 2/1/0 | building heights and massing, street furniture |

Findings, by viewpoint (`mly`):

- **lm01** (2017-04-14, 12 m, partial): Stadio Renzo Barbera, Viale del Fante, 12 m, Apr 2017; the photo looks away from the stadium.
  - [high] [vegetation] `mly` Real roadside is a plaster park wall with flowering Judas trees and stone pines; game has a lawn with spruce cones.
  - [med] [road layout, width, markings] `mly` Real junction has traffic lights on a yellow mast arm, a bus lane and zebra stripes; game has skid-mark pairs across the lanes and a stripe band.
  - [low] [landmarks] `mly` Stadium roof edge is visible top right in the game (teal band); the photo cannot show the stadium, so its shape remains unchecked.
- **lm06** (2021-04-10, 3 m, poor): Cuba Sottana, 3 m, Apr 2021, 37 degrees off, photo shows an old wall with an arched gate and a blossoming tree; the game view is a street with a pink mission-route ribbon laid across the road.
  - [med] [landmarks] `mly` The Cuba Sottana pavilion is not visible in the game view; the real photo shows a weathered ashlar wall with a pointed-arch doorway and street signs for the Cuba. Cannot judge the building from here.
  - [low] [vegetation] `mly` Flowering tree and parked trucks not in the game.
- **lm09** (2019-03-25, 23 m, good): Stazione Notarbartolo, 23 m, Mar 2019.
  - [med] [building heights and massing (coverage)] `mly` Real piazza is enclosed by 4 to 5 storey ochre and cream palazzine with balconies, laundry and tram wires; game has a pale paved piazza with tall 8 to 10 storey ochre blocks and no tram line.
  - [med] [street furniture, props, parked cars] `mly` Tram track and overhead poles, railings, coach and cars missing.
  - [low] [facade style and colour] `mly` Real colours are salmon and cream with arched windows; game ochre.
- **lm14** (2017-08-27, 14 m, good): Albergo delle Povere / Corso Calatafimi side, 14 m, Aug 2017.
  - [high] [vegetation] `mly` Real roundabout edge has dense stone pines, holm oaks and a clipped hedge; game has spruce cones and ball trees on a lawn.
  - [med] [street furniture, props, parked cars] `mly` Billboards, traffic signs, parked cars along the right kerb and tall lamp poles missing; game has pit decals up to 3 m wide and a floating white car.
  - [med] [landmarks] `mly` The Albergo delle Povere is not visible from this stretch in either image; the game shows a dome in the distance, which cannot be verified.
- **lm18** (2018-09-22, 6 m, good): Hotel San Paolo Palace area, 6 m, Sept 2018.
  - [high] [building heights and massing (coverage)] `mly` Real street has low 2 to 3 storey old houses, a tile roof factory building and a ficus; game has a long 4 storey ochre slab with shop shutters and a huge pale piazza behind.
  - [med] [street furniture, props, parked cars] `mly` Parked cars on both kerbs, overhead wires and a pedestrian crossing sign missing; game puddle decal is 3 m wide.
  - [med] [pavements] `mly` Game pale paving apron 10 m wide on the right.
- **lm19** (2021-03-31, 6 m, good): A29 raccordo near Monte Pellegrino foot, 6 m, Mar 2021.
  - [high] [road layout, width, markings] `mly` Real is a dual carriageway with steel guard rails, an edge line and exit signs, a rust-coloured retaining wall; game has a 2 lane road with sand terrain bands and no rails or signs.
  - [med] [terrain] `mly` Real hillside is green scrub and olive with exposed limestone; game slope is bare pale with spruce cones and a white paved patch above the road.
  - [low] [building heights and massing (coverage)] `mly` Hillside houses exist in both.
- **lm20** (2024-04-24, 6 m, good): A29 raccordo, 6 m, Apr 2024.
  - [high] [road layout, width, markings] `mly` Real is a 3 lane motorway carriageway with steel guard rails both sides, rumble strips, billboards and lamp masts, a limestone slope beside it; game has a 2 lane road with a dashed centre line on sand bands, no guard rails.
  - [low] [terrain] `mly` The rocky mountain edge on the right exists in both; game has a ribbed block building at its foot.
- **lm21** (2024-04-24, 4 m, good): A29 raccordo, 4 m, Apr 2024.
  - [high] [road layout, width, markings] `mly` Real motorway has guard rails on both sides and 3 lanes with a hatched shoulder, scrub verges and tall twin lamps; game has a sand band left, lime grass strip right, no rails, a lone spruce.
  - [med] [building heights and massing (coverage)] `mly` Real surroundings are open land with distant ridge; game has dense 7 storey blocks on both sides.
- **lm22** (2024-04-24, 6 m, good): A29 raccordo, 5 m, Apr 2024.
  - [high] [road layout, width, markings] `mly` Real is a 3 lane carriageway with double steel guard rails each side, green gantry sign and distant mountains; game has a plain 2 lane road with a lime strip on the left and a tan band on the right.
  - [low] [vegetation] `mly` Real verges are orchard and scrub; game has ball trees and spruce, similar in volume.
- **lm23** (2017-09-27, 3 m, good): Circonvallazione end, 3 m, Sept 2017.
  - [high] [road layout, width, markings] `mly` Real is a motorway-grade ring road with steel guard rails, green exit signs on a gantry, scrub and a truck; game has a 2 lane road with sand bands and a pale sloping apron.
  - [med] [street furniture, props, parked cars] `mly` Gantry signs, guard rails, lamp posts with arms missing.
- **lm24** (2024-04-24, 4 m, good): Circonvallazione end, 4 m, Apr 2024.
  - [high] [street furniture, props, parked cars] `mly` Real road carries a tram catenary on red poles, a metal fence, a yellow recycling bin, parked cars and a 1970s concrete block with a palm; game has a wide road, sand-coloured bands, a black 3 m pit and a 12 storey ochre tower.
  - [med] [vegetation] `mly` Stone pines and palm behind the fence missing.
  - [med] [facade style and colour] `mly` Real tower is a concrete block with brise-soleil; game tower is a flat buff slab with a window grid.
- **lm26** (2018-09-22, 3 m, good): Cimitero dei Rotoli / Via Messina Marine, 3 m, Sept 2018.
  - [high] [street furniture, props, parked cars] `mly` Real street has cars parked at the kerb, flags of a dealership, traffic lights, a billboard and a Phoenix palm; game has none and an empty pale plain.
  - [high] [building heights and massing (coverage)] `mly` Real street is lined by 4 to 6 storey blocks and a pine grove; game has a big empty plaza and low sheds.
  - [med] [vegetation] `mly` Pine grove and palm missing.
