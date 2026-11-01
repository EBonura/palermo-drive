# Comune di Palermo, Perimetrazione area verde

Used for: `data/verges.json`.

- Licence: CC BY 4.0 (dataset 278 on https://opendata.comune.palermo.it/opendata-dataset.php?dataset=278). The DCAT entry lists it as issued 2013-02-22, modified 2021-09-06; the files inside the zip (`_10012018113342.zip`) are dated Dec 2011 to Jan 2012. The older zip of the same dataset (`_03052013102347.zip`) no longer downloads (the server answers with an HTML page).
- Shapefile `AREA_VERDE`, 2,089 POLYGONZ features, EPSG:3004 (Monte Mario Italy zone 2), reprojected with pyproj (no datum grid, so a metre or two of error is possible).
- Fields: `ID`, `TIPO` (`aiuola` 2,086, `alberi` 3). Nothing else.
- Classification (`tools/green.py classify_verges`, computed from the polygon shape and the baked game roads, nothing is in the source): `median` elongated (aspect 2.5 or more), 25 m wide at most, a carriageway within 4.5 m of both long sides (260, 49,314 m2); `island` compact and ringed by roads (191, 61,486 m2); `verge` touching a road on one side, 10 m wide at most (217, 25,446 m2); `tree_bed` the three `alberi` polygons; `flowerbed` everything else (1,419, 520,148 m2, includes park beds and big lawns such as the Foro Italico one).
- Known issues: no names, no planting information; the classes are a heuristic (a median whose second carriageway is missing from OSM becomes a verge or flowerbed). Almost all polygons are in the built-up area; the survey is more than ten years old.
- Credit line for the README: `Comune di Palermo, Perimetrazione aree verdi (open data), CC BY 4.0.`
