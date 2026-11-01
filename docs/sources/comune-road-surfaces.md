# Comune di Palermo, Perimetrazione area stradale and aree pedonali

Used for: `data/road_surfaces.json` (git-ignored, built by `tools/road_surfaces.py`). Phase 1 only: nothing in `tools/tiles.py`, `src/` or `world/` reads it yet.

- Licence: CC BY 4.0 on all three datasets (https://opendata.comune.palermo.it/opendata-dataset.php?dataset=280, `=281`, `=850`). DCAT dates: 280 and 281 issued 2013-02-22, modified 2021-09-06; the files inside the zips (`AREA_STRADALE` and `AREA_CIRCOLAZIONE_PEDONALE`) are dated 20 Dec 2011 (attributes) and 17 Jan 2012 (geometry). 850 is the 2016 update of the pedestrian-area list (modified 2024-07-18, decrees from 2000 to 2016). The old 2013 zip of 281 (`_03052013102225.zip`) answers 404; the 2018 one works.
- Download: `tools/.venv/bin/python -I tools/road_surfaces.py --download DIR` makes `DIR/strada`, `DIR/pedonale`, `DIR/csv` (each new and empty, only `.shp .shx .dbf .prj` are extracted, by basename). Build: `--strada DIR/strada --pedonale DIR/pedonale --csv DIR/csv/aree_pedonali.csv` (about 4 minutes on 14 cores), add `--report DIR` for the checks and overlays (10 more minutes, plus `--citywide-only` 2 minutes). Needs `pyshp` in `tools/.venv` (`pip install pyshp`, added).

## The sources

- **280 `AREA_STRADALE`**: 4,388 POLYGONZ, EPSG:3004 (Monte Mario Italy zone 2, 15.67 km2 raw, 15.55 km2 after removing overlaps). Fields: `ID`, `CLASSIFICA` (`URBANA DI QUARTIERE` 3,635, `STRADA LOCALE/VICINALE` 437, `URBANA DI SCORRIMENTO` 141, `EXTRAURBANA SECONDARIA` 119, `EXTRAURBANA PRINCIPALE` 48, `AUTOSTRADA` 8), `STATO` (`IN ESERCIZIO` 4,384, `IN COSTRUZIONE` 3 = 0.21 ha, one empty).
- **281 `AREA_CIRCOLAZIONE_PEDONALE_A`**: 3,128 polygons with `ZONA`: `VIALETTO` 2,062 (80.8 ha), `PERCORSO A GRADINATE` 1,061 (2.4 ha), `PASSAGGIO PEDONALE` 4, one empty. They are not pavements: 0.1 % of the `VIALETTO` area lies inside a road polygon and only 6 are within 1 km of Quattro Canti, so they are park, cemetery and estate footpaths and stairs. Output as `pedestrian_areas` (`z` path, stairs, crossing). The `_L` line file (10,487 lines) is not used.
- **850 CSV** (cp1252, `;`): 113 decree rows (street, stretch, council resolution, ordinance, year 2000 to 2016, area). 75 rows match an OSM `highway=pedestrian` name (token match with initials, `S.` = san/santa/sant', multi-street rows split); the 38 others have no pedestrian way of that name in OSM (listed in `meta.decree_unmatched`). **Via Maqueda is not in the list**, nor are Corso Vittorio Emanuele or Via Roma.

## What the road polygon is

It is the whole street space between frontages (carriageway plus pavements), not the asphalt. Evidence: 52 % of its boundary points in the centro and 26 % along Via della Liberta lie within 0.5 m of an OSM building (median distance 0.44 m and 1.95 m); Via Maqueda's polygon is 12.3 m wide and the wall-to-wall width is 12.5 m. In open country the boundary follows the road reserve. So `platform` is exact for "where the street is" (outside it is private land, not pavement), and the asphalt has to be derived (see the script header).

## Reprojection

pyproj EPSG:3004 to WGS84 (no datum grid offline, PROJ falls back to a Helmert transform), then the `tools/bake.py` projection (`LAT0`, `LON0`, `KX`, `KZ`). OSM carriageway centrelines sit 1.0 to 2.0 m west of the centre of the Comune polygons in all six calibration windows, so the script shifts the Comune data by +1.5 m east, 0.0 m north (`meta.datum_shift_m`) before using it.

## What is in `data/road_surfaces.json`

`platform` (777 polygons, class code `motorway arterial extra_main extra_sec urban local`, disjoint), `carriageway` (21.7k, `src` comune or osm), `pavement` (31.5k, `w` width, `src` comune, osm or osm_sidewalk), `verge` (31.8k, `k` verge or shoulder), `plaza` (776, carriageway far from every road line), `pedestrian` (231, `s` decreed or osm, `y` decree year), `pedestrian_areas` (3,129), `decree` (rows plus matched OSM names), `meta` (rules, widths, shift, review list). Coordinates are game metres, flat `p` rings with optional `h` holes, 0.1 m precision.

## Known issues

- **Old and incomplete.** Surveyed 2011-12. Only 50 % of the 2,596 km of drivable OSM road lies within 1.5 m of a polygon (residential 730 of 1,195 km, service 80 of 429, motorways 24 of 44). Whole arterials are missing: Corso Vittorio Emanuele (3.2 km outside), Via Roma (2.7 km), Via della Liberta (2.8 km), Via Regione Siciliana (8.0 km), Viale Europa, the Palermo-Mazara and Palermo-Catania motorways. For those the script falls back to the OSM centreline buffer (`src osm`). 123 ha (7.9 %) of the polygons have no OSM road within 15 m (works since then, wide squares, car parks).
- Squares and car parks inside the polygons are classed as road (Piazza Pretoria is a grey "carriageway" ring). `plaza` takes the parts further than 10 m from any OSM road line, in blobs wider than 8 m (0 to 0.8 ha in each of the five 1.1 km2 test districts, centro 0.8 ha): paving or ground, not asphalt.
- The Comune green data (`data/verges.json`) overlaps the road polygons: 64 % of the `median` area, 32 % of `island` and 43 % of `verge` lie inside a polygon (55 %, 24 % and 34 % inside the derived carriageway). Apply the green data on top.
- Pavement widths are rules, not measurements, except where OSM maps `footway=sidewalk` (1,259 ways, 79 % centred inside the platform, strips of at most 3 m). The rules are calibrated on the same ways: sidewalk centreline to polygon edge is 1.05 / 1.81 / 3.13 m (p25 / median / p75, urban), 1.38 / 2.44 / 4.93 (arterial).
- Cafe terraces, planters and works of the Covid years are not in any of the sources.
- Tunnels are not excluded from the Comune polygons; the OSM fill skips them.

## README credit line

`Comune di Palermo, Perimetrazione area stradale and Aree pedonali (open data), CC BY 4.0.`
