# Regione Siciliana, Carta Tecnica Regionale 1:10,000

Used for: `data/trees.json` (isolated trees), `data/tree_rows.json`, `data/walls.json`, `data/veg_areas.json`.

- Licence: CC BY 4.0. Service: `https://map.sitr.regione.sicilia.it/gis/rest/services/ctr_10000/ctr_2013_dbtrs/MapServer` (EPSG:25833). Download page: https://www.sitr.regione.sicilia.it/download/download-carta-tecnica-regionale-10000/
- Edition 2012-13, but the survey year per feature (`ANNORILEV`) is 2003 for most of it: of the 46,894 walls kept, 41,811 are 2003 and 5,081 are 2012 (all the retaining walls). Treat the data as 2003 with a 2012 patch.
- Fetched by `tools/green_fetch.py ctr DIR` (ids first, then 500 features per POST, 1 s apart): layer 6 (7,178 symbols), 24 (51,193 lines), 25 (4,888 lines), 26 (2,639 areas), 27 (3 areas), inside the game bounding box.
- Fields used: `CODICE` and `DESCRIZION` (class), `ANNORILEV` (kept as `y`), geometry.
  - Trees from layer 6: G003 Albero isolato (4,180), G022 Pino (12), G017 Olivo (272), G016 Albero da frutta (2,283), G033 Agrumi (5). G016, G017 and G033 are orchard symbols (one mark per few trees), flagged `o:1`. Ceduo (G020), Macchia (G030), Vite, Vivaio are not trees and are not used.
  - Walls from layer 24: E003 Muri divisori (`wall`), E002 filo spinato, palizzata, staccionata, cancelli (`fence`), E001 Siepe (`hedge`), E004 Muro a secco (`drystone`), E005 Muro di sostegno testa (`retaining`), E006 piede (`retaining_foot`).
  - Rows from layer 25: G011 Filare di alberi (97), G013 Filare di olivo (22), G014 Filare di frutteto (2). G001 and G002 (field and wood limits) are ignored.
  - Areas from layers 26 and 27: G007 olive grove, G008 orchard, G034 citrus grove, G006 vineyard, G009 scrub/wood, G004 park/garden, G005 nursery (`data/veg_areas.json`, species hints; trees inside one get `c`).
- Known issues:
  - 1:10,000 positional accuracy is a few metres. 86 CTR trees sit on a carriageway, 38 inside a building (dropped), 35 duplicate an OSM tree (dropped).
  - Inside the lidar area 411 CTR isolated trees have no canopy within 4 m and are dropped (stale or misplaced); 1,220 of 1,693 are confirmed (72 %). Outside lidar nothing can be checked.
  - Walls: the dense old town is nearly empty (the 1:10,000 sheet maps parcel walls, not every courtyard): 294 walls in the centro, 158 in Liberta, 830 in Mondello. Many lines in the countryside are field boundaries, so use `st:1` (within 20 m of a carriageway edge, 23,605 of 46,894) for streetside walls. Lines lying on a building outline (217) and a comb of 43 short strokes on the Mondello beach (drawn as retaining walls) are dropped. A wall type says nothing about height.
  - Retaining walls come as a top line (`retaining`) and rarely a foot line; heights must come from the ground.
- Credit line for the README: `Regione Siciliana, Carta Tecnica Regionale 1:10.000 (ed. 2012-13), CC BY 4.0.`
