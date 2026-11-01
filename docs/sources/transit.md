# Transit data: AMAT GTFS (tram and bus), Comune fountains, OSM tram tracks

Phase 1 (prepared, not yet wired into `tools/tiles.py` or the game). Outputs are git-ignored files in `data/`: `tram.json`, `bus_routes.json`,
`fountains.json`. All coordinates are game metres (x east, z south of Quattro Canti, the constants of `tools/bake.py`).

## Sources

**AMAT Palermo GTFS** (bus and tram), Comune di Palermo open data portal.
- Catalogue: https://opendata.comune.palermo.it/opendata-dataset.php?dataset=1807 (one dataset per edition, ids rise with time: 1806 ran 27/07/2026 to
  31/08/2026, 1807 runs 25/08/2026 to 31/10/2026). Download `https://opendata.comune.palermo.it/js/server/uploads/dataset/gtfs/_31082026075636.zip`
  (4.0 MB, 10 text files); `.../gtfs/amat_gtfs.zip` ("last version") is byte for byte the same file (SHA-1 c863b2a5...).
- Used: edition 1807, `feed_version 20260825-20261031`, published 31/08/2026. **It expired yesterday (31/10/2026) and the portal had no newer edition on
  01/11/2026** (ids 1808 to 1812 return the error page). The next edition is due about every two months ("BIMESTRALE"), so refresh with
  `tools/transit_fetch.py` when it appears; the scripts need no change.
- Licence: CC BY 4.0 IT (Note Legali on the portal). The portal adds that the **tram lines were georeferenced with OpenStreetMap data (ODbL) and the tram data
  is licensed CC BY-SA 4.0**. The game's map files are ODbL already, so tram geometry stays under ODbL and the tram credit must name OSM and AMAT.
- The portal warns that works on the railway "passante" and "anello" change bus routes and times in the affected areas relative to the dataset.

**Fountains**: "Dataset della dislocazione delle fontanelle per acqua potabile (AMAP)", dataset 1249,
https://opendata.comune.palermo.it/opendata-dataset.php?dataset=1249, CSV `https://opendata.comune.palermo.it/ws.php?id=1905&fmt=csv` (11 KB).
CC BY 4.0 IT. List supplied by AMAP SpA to the Comune, coverage 2019 (published 29/08/2019); the portal says positions may change for safety reasons.

**OpenStreetMap** (ODbL, Geofabrik extract `data/city/isole-latest.osm.pbf`, the project's own source): `railway=tram` ways, tram stops, platforms,
the AMAT `route=tram` relations, roads and barriers beside the tracks, `highway=bus_stop`, `amenity=drinking_water`, and all `route=bus` relation tags.

## Scripts (`tools/.venv/bin/python -I`)

1. `tools/transit_fetch.py <gtfs_dir> <fountains_dir>`: both downloads, each into its own new empty directory; picks the newest edition covering today, else the
   latest and warns. The zip is unpacked flat (`*.txt` only).
2. `tools/transit_osm.py`: cuts the tram and bus data out of the PBF into `data/tram_osm.json` (about 90 s).
3. `tools/transit.py <gtfs_dir> <fontanelle.csv> [tram|bus|fountains|all]`: builds the three outputs (a few seconds).
4. `tools/transit_check.py <out_dir> [gtfs_dir]`: overlay PNGs and the counts below.

## Fields used

GTFS: `feed_info` (validity), `routes` (short name, long name, colour; `route_type 0` is the four TRAM routes, the rest are buses), `trips` (route, direction, shape),
`stop_times` (stop order, first departure; trips are grouped into patterns of route, direction, shape and stop list), `shapes`, `stops` (name, lat, lon).
`calendar_dates` is not used (the feed has no `calendar.txt`, so trip counts are over all service dates in the feed, not per day). Trip headsigns are empty.
Fountains: `Indirizzo`, `latitudine`, `longitudine`, `Nome` (FONTANELLA or FONTANA).

## Numbers (run of 01/11/2026)

- **Bus**: 67 routes (71 in the feed minus 4 tram), 153 patterns, 1,594 stops used. Against `data/bus_routes_osm.json` (what the game bakes today): 25 routes
  agree (85 percent or more of the main shapes within 30 m of an OSM line), 15 differ (coverage 39 to 84 percent: 104, 237, 209, 226, 134, 210, 234, 124, 103, 212,
  246, 100, 224, 230, 534), 27 are missing: 516, 606, 616, 619, 625, 628, 645, 675, 704, 721, 731, **806**, 812, 84, 86, 87, 88, ARANC, C.R., N1 to N7, OSPED.
  Six OSM refs are not in this feed (225, 231, NCS, NFE, Universita, Verde: old or special lines). 1,113 of 1,594 stops have an OSM bus stop within 40 m (481 do not).
- **806** (Piazza Crispi to Mondello): no OSM relation of that ref exists anywhere in the extract. Four patterns, 96 trips each in the feed (two per direction,
  9.7 and 10.5 km out, 10.8 and 11.2 km back, 23 to 27 stops, first departure 05:45, last 22:58). The overlay `bus_806.png` shows the shape runs where no
  OSM bus relation runs. (The other missing refs are not checked one by one: the PBF has a ref 721 but it is the ARST line in Sassari.)
- **Tram**: 4 lines, 7 directional patterns, 74 distinct stops (102 stop visits; each stop is tied to an OSM tram stop and a platform way, all platforms within 4 m
  of the track), 93 OSM track chains of which 31 carry a line (29.7 km of track, both directions counted), 73 `tram_crossing` nodes, 111 buffer stops.
  GTFS shape against the matched OSM path (every 3 m of the shape): mean 5.0 to 7.8 m, median 4.5 to 6.5 m, p95 7.8 to 11.9 m, maximum 71 m (terminus loops); 89 to
  99 percent within 10 m. The GTFS shapes have a point every 100 m and sit about 5 m beside the OSM tracks (the spacing of the double track), so they are only
  a guide; the OSM tracks are the geometry. The matched paths use 33 of 33 (L1), 34 of 35 (L2), 35 of 35 (L3), 19 of 19 (L4) track ways of the OSM route relations.
- **Fountains**: 150 Comune entries (133 fontanella, 17 fontana), none duplicated, all inside the city box; 46 have an OSM `drinking_water` node within 50 m; OSM has
  130 such nodes, 85 are more than 25 m from any Comune entry (kept as `osm_only`, ODbL).

## Reading `data/tram.json`

`lines[]` (1 to 4): `directions[]` with ordered `stops` (name, GTFS position, `on_track` position, chainage `s`, `platform` polygon line with `side` of travel and shelter/bench
flags, OSM stop id), `tracks` (ids of the chains it uses), `path` (the line as a polyline on the OSM tracks, the route a tram would drive), `trips`, first and last
departure. `tracks[]`: the physical rails, one polyline per track and direction (double track = two polylines about 5 m apart), `lines` using it, `oneway`, `service`
(siding or crossover when set), `bridge`, `covered`, `maxspeed_kmh`, and `stretches` (distance along the track, `mode`, `railing_osm`). Modes come from the OSM roads
that run parallel (within 28 degrees) within 40 m: `street` (road within 2.5 m, tram in the carriageway), `median` (parallel roads on both sides, a reserved strip between
carriageways), `roadside` (road on one side only), `separate` (none). Short runs under 40 m are absorbed by the neighbour. Over the line tracks: median 25.5 km, roadside 3.9 km,
street 0.2 km, separate 0.1 km, so the network is almost all median, which matches the photos. This is a heuristic on OSM roads, not a tag: look at the overlays before trusting a
single stretch.

- **Railing**: OSM maps it on only 0.2 percent of the track length (`railing_osm`), so it cannot come from the tags. The Mapillary photos (2019 to 2021) show a black iron
  railing with arched panels on a low concrete plinth along the median stretches (Via Leonardo da Vinci, Viale Regione Siciliana, Via Notarbartolo, Corso dei Mille). Use it for
  `median` and `roadside` stretches, with gaps at `crossings` and at stops.
- **Catenary**: poles are not in OSM or in the GTFS; **spacing and side are unknown** (`catenary.pole_spacing_m` and `side` are `null`). The photos show dark red steel poles on
  the median beside the railing with bracket arms and wires over the tracks. OSM tags: `electrified=contact_line`, `voltage=750`, `gauge=1435`.
- Maximum speeds 15, 30, 50 and 70 km/h come from OSM `maxspeed`. Stops have a bench and shelter flag from the platform ways where mapped.

## Known issues

- The feed has expired (see above). Stops and shapes rarely move between editions, but works on the railway ring change bus routes.
- Bus shapes were not checked for accuracy against the roads except 806. Bus patterns have no headsign. Trip counts are over the whole feed.
- GTFS terminus stops can sit 54 to 74 m from the OSM tram stop (Notarbartolo, Piazza Amerina); the OSM stop wins for geometry.
- `differs` bus routes with low coverage (104, 237) may be real route changes or OSM relations that are old; not examined.
- Fountain positions are a 2019 list; about two thirds of them have no OSM counterpart, and OSM has 85 more that the list lacks.
- The tram modes depend on the OSM roads next to the tracks; a hand-mapped median in OSM would change the labels.

## Credit lines for the README (`Credits and licences`)

- Bus and tram routes, stops and timetables: AMAT Palermo S.p.A. open data, GTFS feed published by the Comune di Palermo (opendata.comune.palermo.it), CC BY 4.0. Tram line
  geometry follows OpenStreetMap (ODbL), as in the feed itself.
- Public drinking fountains: Comune di Palermo open data, "Dataset della dislocazione delle fontanelle per acqua potabile (AMAP)", data supplied by AMAP S.p.A., CC BY 4.0.
- Tram tracks, platforms and drinking water points: Map data © OpenStreetMap contributors, ODbL (already credited above).
