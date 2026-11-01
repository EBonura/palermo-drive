# Comune di Palermo, Carta Tecnica Comunale: Unita' Volumetriche

Building-volume polygons with eave and foot elevations for the whole comune. Used (phase 1, not yet integrated) for two things:
extra footprints OSM lacks, and measured heights for OSM buildings that have no lidar roof.

## Source

- Dataset page: https://opendata.comune.palermo.it/opendata-dataset.php?dataset=1294 (also dataset 269). Download the page links to
  `https://opendata.comune.palermo.it/js/server/uploads/dataset/shp/_09062021064719.zip` (16 MB, four files `VOLUMETRIE_7792.*`).
- Licence: CC BY 4.0 IT (https://creativecommons.org/licenses/by/4.0/deed.it). Attribution required, no share-alike.
- Survey 2013 (portal: coverage 01/01/2013 to 31/12/2013), published 07/06/2021, updated 08/06/2021. Carta Tecnica Comunale numerica, scale 1:2000.
  Author on the portal: Giuseppe Meli, Direzione Generale.
- 100,432 polygons (100,469 once multipart shapes are split), PolygonZ, CRS RDN2008 / UTM 33N (EPSG:7792, the .prj; the portal says EPSG:25833, the two
  differ by far less than a metre here). Sum of polygon areas 16.4 km2.

## Fields used

`ID` (unit id, unique except 144 repeated rows), `QUOTA_GRON` (eave elevation, m above sea level), `QUOTA_PIED` (foot elevation, m above sea level),
`ALTEZZA` (height). `ALTEZZA` equals `QUOTA_GRON - QUOTA_PIED` on every row (max difference 5e-15), so there is only one height to trust, and it is the
eave height (a flat roof or parapet top, the eave line of a pitched roof, not the ridge). `AREA` and `VOLUME` are not used (`AREA` is the plan area
within 0.5 % of the projected polygons, `VOLUME = AREA * ALTEZZA`). The Z of the shape vertices (about 42 m at Palermo) is not an elevation of the
building and is ignored. `ID_UN_VOL` carries no building grouping (it is unique per row), so buildings are rebuilt geometrically.

## Pipeline: `tools/footprints.py`

    tools/.venv/bin/python -I tools/footprints.py PATH/VOLUMETRIE_7792.shp [--report DIR]

Needs `pyshp` (added to `tools/.venv`) plus the existing shapely, pyproj, numpy, PIL. Reads OSM buildings from the same cache `tools/tiles.py` bakes
from (`data/city/pbf_bld_*.json.gz`). Writes `data/footprints_extra.json` and `data/footprints_osm_heights.json` (both git-ignored). About 25 s.

1. Project to game metres (x east, z south of Quattro Canti, `bake.py` constants). Check: of OSM buildings with a counterpart in the volumes (IoU above 0.6, sample
   of 6,083), 83 % coincide to within 5 cm and the median offset is 0.00 m in x and z, so the frame is right. OSM contains about 36,500 buildings tagged
   `source=Comune di Palermo`, i.e. this survey was already imported into OSM.
2. Overlap rule: a unit is dropped when more than 20 % of its area lies inside OSM buildings grown by 1 m. A threshold of 50 % was tried first and
   rejected after looking at images: mid-range overlaps are OSM buildings redrawn, rebuilt or merged since 2013, and adding the rest doubles them.
   Units under the 20 % limit have the OSM footprints (grown 0.3 m) cut out. 98,438 units dropped, 1,354 cut.
3. Filters on what is left: height under 1.5 m (walls, terraces), over 75 m (survey error; none occurred), area under 12 m2, narrower than 2 m
   (a negative buffer of 1 m empties it). Merged buildings under 40 m2 and lower than 2.6 m are sheds and dropped.
4. Merging: pieces that share at least 1.5 m of wall (or overlap) belong to one building, strongest shared walls first, never growing past 2,500 m2.
   Outline = union (hairline gaps under 0.3 m closed, simplified 0.25 m), courtyards over 6 m2 kept as `holes`.
   `h` = the area-weighted median of the unit heights. Units that differ by more than 0.8 m become `parts`: without a courtyard the parts partition
   the footprint (`split: 1`, every unit not at the main height), with a courtyard only what stands more than 3.5 m above the main body, the same
   convention as `raster_shape` for lidar.
5. Result: 1,526 buildings (0.387 km2, median height 5.6 m, 5th to 95th percentile 2.7 to 29.6 m), 256 of them merged from several units, 211 with parts,
   84 with a courtyard.

## `data/footprints_extra.json`

    {"source": ..., "height": ..., "buildings": [
      {"id": "x76362", "oid": 76362, "tags": {"building": "yes", "height": "4.3"},
       "outer": [[x, z], ...], "holes": [[[x, z], ...]],             // holes only when present, pairs in game metres, 0.1 m
       "h": 4.3, "g": 155.6, "n": 1,                                  // main height, foot elevation (area-weighted), units merged
       "parts": [[[x0, z0, x1, z1, ...], height], ...], "split": 1}   // only when units differ; heights are relative to the foot
    ]}

`id` is `x<smallest unit ID>` (suffix `.k` if a repeated ID lands in two buildings), unique, never clashes with OSM `w`/`r` ids. For tiles.py:
`add(rec["id"], rec["oid"], rec["tags"], rec["outer"], rec.get("holes", []))`. `tags.height` makes `building_height` return the CTC height, and a lidar
raster or lidar.json roof still replaces it as for OSM buildings. `add()` does not take `parts`; to use them set `b["parts"] = [[p, g + h] for p, h in
rec["parts"]]`, `b["split"]`, `b["r"] = g + h`, `b["g"]` yourself (parts in `world/tiles` hold absolute roof elevations).
`g` and `r` are absolute, in the lidar frame (see the check below).

## `data/footprints_osm_heights.json` (the bigger win)

`{ "<tiles.py building id, e.g. w123 or r45.0>": {"h", "g", "r", "n", "parts"?, "split"?} }` for the 72,301 OSM buildings at least 60 % covered by
volume units: `h` = weighted median unit height inside the building, `g` foot and `r` eave elevation (absolute), `parts` as above, clipped to the OSM outline.
48,368 of these have no lidar roof in the baked tiles, which today fall back to the generic district estimate.

## Quality (numbers from `--report`, report.json)

Coverage of land in each district (discs of 0.6 x the zone seed reach from `src/districts.js`, clipped to the manifest coastline):

| district | OSM | OSM + added | CTC alone |
|---|---|---|---|
| centro | 48.5 % | 48.9 % | 48.1 % |
| Oreto | 26.4 % | 27.1 % | 25.3 % |
| Brancaccio | 21.6 % | 22.0 % | 19.9 % |
| Uditore | 22.9 % | 22.9 % | 22.2 % |
| Cruillas | 22.8 % | 22.8 % | 21.9 % |
| ZEN | 17.1 % | 17.1 % | 16.9 % |
| Mondello | 14.6 % | 14.7 % | 13.7 % |

The low coverage in the outskirts is real density, not missing OSM buildings: the survey itself shows the same percentages. Added buildings per
district: 38 centro, 25 Oreto, 29 Brancaccio, 0 Uditore, 0 Cruillas, 0 ZEN, 8 Mondello.

Heights against the lidar roofs already baked in `world/tiles` (23,813 OSM buildings that have both; CTC height minus lidar `r - g`): bias -0.01 m,
median -0.10 m, rms 3.21 m, mean absolute error 1.90 m, correlation 0.912. Foot elevation minus lidar `g`: bias +0.05 m, rms 1.43 m. Eave minus lidar
`r`: bias +0.02 m, rms 3.07 m. So the absolute elevations are in the same frame as the game's lidar terrain. Tall buildings are under-read a bit (lidar 20 m and above:
bias -1.33 m), low ones over-read (lidar under 6 m: +1.13 m); a single scale factor gains nothing (k = 0.977, rms 3.20). On the added buildings,
663 of 1,526 have lidar coverage: bias +0.69 m, median +0.10 m, rms 5.28 m, 76 % within 3 m, 5 % more than 8 m taller than the lidar says.

## Known issues

- The survey is from 2013. Anything built, demolished or extended since is wrong or missing; the added set contains some demolished buildings (the 5 % where the
  survey is 8 m or more above the lidar are the likely ones), and nothing newer than 2013 appears. 98 % of the units are already in OSM, so the footprint gain is small.
- Heights are eave heights: a pitched roof has no ridge, and a hillside building's `ALTEZZA` is measured to the lowest foot elevation.
- Units merge by adjacency, so a terrace of houses can become one building (capped at 2,500 m2) and gets one colour from the building style.
- Mid-range overlaps with OSM (20 to 50 %) are dropped, not cut, on purpose; a CTC building next to a redrawn OSM one is not added.
- The merge uses a single polygon per building: if the union splits in two, the smaller piece is lost (not counted, rare).
- The frame uses `bake.py`'s fixed `KX` at Quattro Canti, like the rest of the game (0.1 % scale error at the edges of the bbox, it is the same for OSM).

## Gap check with the backup source

Microsoft GlobalMLBuildingFootprints, quadkey 122010213 sampled in `palermo-sources/ms213.gz`: it covers centro, Oreto and Brancaccio only. Footprints of 25 m2 or more
in neither OSM nor the CTC (both grown 1 m, under 20 % covered): 12 in centro (0.1 % of land), 37 in Oreto (0.6 %), 40 in Brancaccio (0.7 %). The other four districts are not in that
quadkey file. Not integrated; it would add at most under 1 % of land cover there.

## Credit line for the README

Building volumes and heights: Comune di Palermo, Carta Tecnica Comunale, Unita' Volumetriche (2013), CC BY 4.0 IT, https://opendata.comune.palermo.it/opendata-dataset.php?dataset=1294
