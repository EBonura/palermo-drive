# Faithfulness survey: summary

Reviewer: independent adversarial pass. 304 street-level viewpoints (snapped to OSM road centrelines, eye height 1.6 m, 11:00) and 26 aerials were shot in the game from headless Chrome and compared with the real city. Real-world references were looked at only (nothing copied): about 25 Google Street View panoramas and 3 satellite views loaded successfully in the browser pane (the pane often failed to render a pano, so the number is far below the 300 asked for); the rest of the comparison is the in-game image against knowledge of Palermo. Each finding is tagged `sv` (checked against Street View or satellite), `mem` (from memory, verify) or `game` (defect visible in the game alone). In addition every viewpoint was ray-cast in the running game to test whether the road is buried by terrain, and a dense scan of the mountain-foot roads is in `buried-roads.md`.

Files: `viewpoints.json` (list), one `<area>.md` per area, `aerials-and-cross-cutting.md`, `buried-roads.md` and `buried-roads.json`.

## Counts of findings by layer and severity

| layer | high | med | low | total |
|---|---|---|---|---|
| road hidden by terrain | 10 | 7 | 5 | 22 |
| road layout, width, markings | 4 | 12 | 3 | 19 |
| pavements | 9 | 5 | 0 | 14 |
| facade style and colour | 0 | 1 | 10 | 11 |
| vegetation | 4 | 5 | 1 | 10 |
| terrain | 1 | 6 | 2 | 9 |
| landmarks | 1 | 4 | 3 | 8 |
| walls, gardens, fences | 3 | 0 | 0 | 3 |
| building heights and massing (coverage) | 2 | 1 | 0 | 3 |
| coastline and sea | 0 | 1 | 2 | 3 |
| street furniture, props, parked cars | 0 | 0 | 1 | 1 |
| viewpoint notes | 0 | 0 | 1 | 1 |
| **all** | 34 | 42 | 28 | 104 |

Findings per area file: centro 7, politeama 6, mondello 17, pellegrino 18, zisa 14, sud 12, porto 5, landmarks 12, global 13.

## Top 30 problems, ranked by damage to recognisability

Grouped by layer in the order they first appear; the number is the rank. `n` = how many survey viewpoints (street and aerial) the problem was seen in.

### pavements (2)

1. **[high]** White paving halos: the raised layer is a 15 to 40 m blob around every building cluster outside the old town, so streets sit in huge empty plazas (Mondello, ZEN, Zisa, Boccadifalco, Brancaccio, Villagrazia, Addaura). (n=71)
7. **[high]** Tan sand bands and terrain-tint patches replace kerbs and verges next to asphalt (3 to 15 m each side, 20 to 70 m on the ring road, Via Oreto, south coast). (n=37)

### building heights and massing (coverage) (3)

2. **[high]** Missing buildings outside the centro: footprint share of ground is 13 to 23 % in Brancaccio, Oreto, Uditore, Cruillas, ZEN, Mondello, Tommaso Natale against 50 % in the old town; satellite shows continuous blocks in Brancaccio and Street View shows street walls on Via Oreto where the game has an empty plain. (n=14)
13. **[high]** Via Oreto, Via Salvatore Corleone and the SS113 south of Romagnolo are empty tan plains in the game; Street View has continuous building rows, eucalyptus rows, farmhouses and utility poles. (n=14)
24. **[med]** Via Patti (ZEN fringe): real narrow country lane with scrub, wall and a pylon (Street View); game places a wide white plaza and a 6 storey slab there. (n=1)

### vegetation (2)

3. **[high]** One spruce-cone tree model on lime lawn for hills, parks, avenues and seafront; real trees are Aleppo/stone pine, holm oak, ficus, palms, eucalyptus, plane, carob, olive, in dry ochre ground. (n=30)
14. **[high]** Favorita: lawn with spruces instead of the real tunnel of holm oak/carob over Viale Diana and Viale Ercole, orchards and walled plots. (n=3)

### road hidden by terrain (4)

4. **[high]** Roads buried under terrain on the mountain: Via Pietro Bonanno (up to 6.6 m at 38.16016,13.34982, 5.94 m at 38.15217,13.36476, 2.06 m at the hairpin crown), Via Monte Ercta, Via Poggio Ridente (2.28 m), Via San Martino, Lungomare side streets; the effect depends on tile load order (cold spawn or teleport shows it, flying in from afar does not). (n=20)
6. **[high]** Viale Regione Siciliana Nord Ovest at 38.13036,13.33005 has no road mesh at all (17 of 70 samples without asphalt); satellite shows a 3+3 lane dual carriageway with median and slip roads. (n=1)
12. **[high]** Road-shaping bench failures: Via Pietro Calandra Sferracavallo (12 buried samples, 2.72 m, sand tongue across the road), Via Spina Santa shelf, Via San Martino tongue with hard polygon edge. (n=3)
19. **[med]** Even in the flat centro: Via Pacinotti 2.72 m, Piazza Santa Teresa 1.77 m, Piazza Tredici Vittime and Via Crispi 1.11 m, Politeama squares 0.3 m. (n=13)

### road layout, width, markings (4)

5. **[high]** Motorways and dual carriageways drawn as one 2-lane road: A29 link road, Viale Regione Siciliana at both ends, Via Castellana. No median, shoulder, guard rail, edge lines or signs. (n=14)
11. **[med]** Road decals: black hexagon potholes, blue puddles at 11:00, long skid pairs, black-outlined patches, 5 to 10 per view on residential streets. (n=22)
20. **[med]** Via Pietro Bonanno is 8 m asphalt with pothole decals; real is 5.5 to 6 m, smooth, with a centre dash and parapet. (n=6)
23. **[med]** Mondello seafront: real road is one wide carriageway with a sand verge and kerbside parking; the game has a 15 m paved esplanade on the sea side. (n=3)

### walls, gardens, fences (1)

8. **[high]** No garden walls, hedges, parapets or gates: Mondello villas stand on bare paving; Via Pietro Bonanno has no 0.8 m stone parapet; Addaura lanes lack hedges and walls (Street View shows them everywhere). (n=17)

### terrain (5)

9. **[high]** Monte Pellegrino terrain: uniformly dark green from the air, cliffs with vertical texture streaks, terrain spikes at hairpins, lime meadow instead of dry straw and grey limestone, no scrub or rock outcrops. (n=12)
21. **[med]** Ciaculli, Falsomiele and Villagrazia: no orchards (mandarin and citrus groves), no terraces, plain beige slopes. (n=9)
22. **[low]** Far terrain hard clip edges and an LOD tone band (Bellolampo, north coast, Mondello plain). (n=4)
25. **[med]** Tan terrain polygons show through on old-town streets (Sant Agostino, Porta Nuova) and ragged gaps where the paving layer is missing. (n=4)
29. **[low]** White triangular wedges (paving polygons) hanging over cliff tops. (n=2)

### landmarks (3)

10. **[high]** Santuario di Santa Rosalia and Castello Utveggio not visible from the road at their own coordinates; a white paved slope sits in their place. (n=2)
18. **[med]** Stadio Renzo Barbera and La Zisa: stadium roof and floodlights, castle arcade, pool and garden are weak or absent from street level. (n=7)
27. **[med]** Politeama theatre, Quattro Canti street level and the Cattedrale approach need a dedicated camera check (second to fourth most recognisable spots). (n=7)

### coastline and sea (2)

15. **[high]** Foro Italico has tan dirt bands, lawn and spruces with no palm avenue, no sea wall, no balustrade (Street View not loadable at this spot, from knowledge). (n=5)
28. **[low]** Mondello pier and cabins, SS113 shoreline: present from the air, quay and beach details missing at street level. (n=9)

### street furniture, props, parked cars (2)

16. **[med]** Parked cars along both kerbs of residential streets are missing (Street View Via Lanza di Scalea: nose-to-tail Pandas both sides). (n=3)
30. **[low]** Street lights are 12 to 14 m posts at irregular spacing; real Mondello and residential streets use 5 to 7 m poles. (n=5)

### facade style and colour (2)

17. **[med]** ZEN, Tommaso Natale and 1970s blocks: dark-glazed grids and bunting squares instead of grey-white concrete, plaster patches, arcaded ground floors. (n=5)
26. **[low]** Ground-floor shutters and bunting repeat on every facade; long blocks have a single bay pattern for 80 to 120 m. (n=27)

## What is already good

Old-town street level (Via Maqueda, Pretoria, Cattedrale, Kalsa alleys), port, Cala, Foro Italico and Villa Giulia from the air, the Mondello bay with the pier, and the sea colour are close to the real place and can be the quality bar for the rest. Facade massing, shutters, balconies and shop fascias in the old town read as Palermo.

## How reliable is this

Street View refused to render in about half of the attempts (black frames), so references were limited. Findings tagged `mem` have not been checked against an image. Terrain-over-road numbers are measurements, not opinions, but they depend on streaming order (see `buried-roads.md`).

