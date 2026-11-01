# World tiles: format for the whole-city map

The world grows from the centro storico to all of Palermo plus Mondello, Monte Pellegrino and the
coast. Everything is baked into square tiles that the game streams around the car.

## Area and grid

- Bounding box (lat/lon): south 38.065, west 13.285, north 38.225, east 13.420
  (Mondello and Valdesi in the north, Oreto and Brancaccio in the south, Boccadifalco/Uditore in the
  west, the coast in the east).
- Same local projection as everywhere else (`tools/bake.py`): origin Quattro Canti,
  `x = (lon - 13.36126) * cos(38.11572°) * 111320`, `z = -(lat - 38.11572) * 110540`.
- Tile size `T = 500` m. Tile `(i, j)` covers `x in [i*T, (i+1)*T)`, `z in [j*T, (j+1)*T)`.
  Tile id string `"i_j"` (negative numbers allowed, e.g. `"-3_2"`).

## Files (served statically, gzip handled by the host)

- `world/manifest.json`:
  `{ "T": 500, "bbox": [x0, z0, x1, z1], "tiles": { "i_j": { "b": buildingCount, "bytes": n } },
     "spawn": [x, z], "landmarks": [{ "n": name, "x", "z" }], "far": {terrain grid like today's D.far},
     "land": flat coastline polygon }`
- `world/tiles/i_j.json`: one tile, with the same field names and shapes the modules already use on
  `PALERMO_DATA`, but only for that tile, so module code keeps working per tile:
  - `buildings[]` (same fields as today: id, p, holes, h, r, g, parts, split, c, k, n, t, lv, hi, am...).
    A building belongs to the tile containing its centroid; its footprint may cross the border.
  - `roads[]` clipped to the tile (centrelines keep class, width, name).
  - `streets`: `asphalt/paving/raised/green/water` polygons and `curbs` clipped to the tile, plus `aoi` = the tile rect.
  - `areas[]`, `labels[]`, `props` (OSM street furniture in the tile, same structure as props-data.js).
  - `near`: lidar DTM grid for the tile where we have one (same structure as today's `D.near`).
- Coordinates rounded to 0.1 m. Target under ~300 KB raw per dense tile.

## Runtime (src/world.js, lead)

- Loads the manifest at start, then tiles in rings around the car: full detail within ~600 m,
  low detail (simple extrusions, no props) to ~2 km, the far terrain beyond.
- Builders are called per tile: `buildBuildings(ctx, tile)`, `buildProps(ctx, tile)`,
  `buildLandmarks(ctx, tile)`, each returning a `THREE.Group` that `world.js` adds and later disposes.
- Collision and the street index are per tile too.

## Runtime as built (phase 1): src/world.js, src/streets.js

- `main.js` creates `createWorld(...)` only with `?world=1`; the default game is untouched. With the flag, the centro's own buildings,
  streets, near terrain, far terrain and wall segments are skipped (tiles bring them); props, landmarks, pedestrians, traffic, roadwear,
  missions, context and the sea still run from the baked centro data (see phase 2).
- Per tile `lod`: 2 = full detail (< `rfull`, 650 m desktop / 380 m phones), 1 = low detail (< `rlow`, 2200 / 1300 m), 0 = nothing (far grid
  terrain from the manifest shows; tiles with terrain punch holes in it). URL overrides: `rfull`, `rlow`, `tricap`, `wbudget` (ms of
  streaming work per frame), `worldurl`, `wstats` (overlay), `at=x,z` (stream the destination in, then place the car).
  Hard cap on resident triangles (`tricap`, 2.8M desktop / 650k phones): the nearest tiles claim the budget, the rest are demoted.
- Streaming work is generators stepped under a per-frame time budget, nearest tile first; fetches 4 at a time, nearest first; parsed
  tiles that leave the radius stay in a 10-tile LRU; geometries are disposed with their tile part, materials/atlas are shared.
- Ground: `core.js groundY` asks `hooks.ground` (loaded tile near grid, else the manifest far grid, plus road-bench shaping), and falls back to
  the baked centro grid until the centro tiles are in. `hooks.bounds` is the manifest bbox (vehicle.js clamps to it).
- Hill roads (no lidar or > 150 m): `computeShape` carves a level bench along every drivable road at a blurred copy of the ground height
  (continuous across tile borders), easing back to the raw ground over 11 m. Streets, curbs, trees, buildings, the car and the terrain mesh
  (5 m grid under shaped tiles) all see it through `groundY`.
- Full-detail tiles also register: wall segments (`walls2d.ext`), road names (`streets.ext`), drivable road vertices (`roadVerts`, so
  `placeAt` works anywhere once the tile is in), a raised-ground mask and a hard-surface mask (0.5 m bits), instanced pines in forest/green
  areas, dirt-track strips (`highway=track`), and any `CITY_LANDMARKS` (src/landmarks-city.js) whose x,z falls in the tile.
- `world.drivePlayer(car, dt)` (called from the physics loop): off the hard surface the car loses a third of its grip, bounces and drags a little.
- `world.isLand(x, z)`: manifest coastline; main.js only runs the sea's drowning check when it is false.

## Default and per-tile hooks

- The whole city is the only map: there is no flag, main.js always creates the streamer (the owner wants no variants).
- `world.onTile(fn)`: `fn('full', t)` when a tile reaches full detail, `fn('drop', t)` just before it leaves full detail (downgrade or release).
  New subscribers get `'full'` replayed for every tile already at full detail. Returns an unsubscribe function. `t.i`, `t.j` (tile indices,
  `T = 500` m), `t.k` (numeric key), `t.data` (the parsed tile: buildings, roads, streets, areas, labels, props, near).
- `world.fullTiles()`: the tiles currently at full detail. `main.js` exposes the streamer as `world` (and on `window.game.world` with `?debug`).

## Phase 2 status (2026-10-31)

Done, all per tile through `world.onTile`, no centro-only path left: traffic (src/traffic-graph.js road graph, AMAT routes over the bbox),
pedestrians (per-tile walkable blocks, district crowd profiles), props (per-tile generator, district tables, lamps feed daynight via
`pd-lamps-changed`), road wear, sea (manifest land/islands shore field), minimap (src/minimap.js per-tile pieces). Still open: missions routing on
`traffic.graph`, the far city LOD (context.js), photo facades are city-wide already. The list below is the original plan, kept for reference.

## Phase 2: what each module needs to become per-tile

- **props.js**: takes `(ctx, tile)`; reads `tile.props` (`items`, `areas`, `counts`), `tile.streets` masks (asphalt/paving/raised rasters per
  tile, the same 0.5 m masks world.js already builds), `tile.buildings` for wall mounts; returns a Group + a collide hook per tile. Today
  it builds once from props-data.js and `D.bounds`.
- **landmarks.js**: `buildLandmarks(ctx, tile)` per tile with `prepareLandmarks` computing `ctx.skip` per tile; or move to
  `CITY_LANDMARKS` (hook already in world.js).
- **pedestrians.js**: needs its walkable-zone raster per tile (green/paving/raised/water from `tile.streets`) and spawn/despawn by tile
  instead of one AOI (`D.streets.aoi`).
- **traffic.js**: needs the road graph across tiles: merge `tile.roads` per resident tile (junctions at tile borders join on the clipped
  endpoints), spawn only within the full-detail radius.
- **roadwear.js**: its 0.5 m asphalt raster is built from `D.streets.asphalt` over one AOI; make it per tile (reuse `buildRaised`'s band
  rasteriser) and seed holes by tile id.
- **missions.js**: pickups/destinations from `manifest.landmarks`; routes need the cross-tile road graph above.
- **context.js**: replaced by a real far-LOD city (merged extruded blocks from the tiles at 2-6 km); today its chunks are hidden under loaded tiles.
- **sea.js**: land/shore fields come from `D.land` (centro); needs the manifest `land` + `islands` polygons and the harbour mask per tile.
- **main.js**: the minimap draws only the baked centro (`mapCanvas`); needs per-tile map tiles (land/roads/buildings) drawn on demand.
- **buildings.js**: streamed tiles skip the photo facades (`assets/facades/photo`); give them the same per-building-id lookup, and a shared
  zone table for neighbourhood colours beyond the centro.
- **Data (tools/tiles.py)**: done, see "Terrain and track data" below.

## Terrain and track data (tools/tiles.py, tools/dem.py, tools/lidar_hills.py)

- **Tracks.** `HIGHWAYS` / `ROAD_WIDTH` now include `track` (3.5 m) and `bridleway` (2.5 m). Both are baked into `roads[]` with
  `k: "track"` (the width tells them apart) because `src/world.js` draws exactly `k === 'track'` as a dirt strip and also lists it in
  `roadVerts`. They have no asphalt (not in `CARRIAGEWAY`), so they stay off the hard-surface mask. The OSM extract has about 530 ways
  (all `highway=track`, no bridleways); the PBF cache must be re-extracted after changing `HIGHWAYS` (delete `data/city/pbf_hwy_*.json.gz`).
- **Bbox-edge seams (`10_6|10_7`, `-14_-16|-14_-15`).** Root cause: the land polygon only exists inside the bbox rectangle, and
  `near_for` clamped every point that is "not land" to -1.5 m. Tiles that straddle the east/west bbox edge got -1.5 m outside the
  rectangle while their far-grid neighbour kept the real ground (34 m and 247 m): the 35 m and 248 m steps (and 32 / 25 / 20 / 8 m on
  `10_x|11_x`). The clamp now only applies inside the rectangle. The ~1.5 m underwater step along the open coast (clamp -1.5 vs far grid 0) is left.
- **Hills.** Terrarium (the far grid's source) is 100 to 200 m off on Monte Pellegrino's slopes (checked against lidar point queries
  along the Pietro Bonanno road: bias -118 m, rms 127 m between 205 and 400 m) and the lidar rasters are blind above 204 m. The
  terrain above 80 to 140 m (smooth blend, `HILL_LO`/`HILL_HI`) is now:
  1. lidar where we have it: the decoded 2 m rasters below 204 m, and above that `tools/lidar_hills.py`, which asks the same WMS
     `GetFeatureInfo` for the true height of the lidar pixel on a 20 m lattice (about 19.5 k queries, raw answers in
     `data/dem_lidar_hills/points.json`, resumable). GetFeatureInfo is accurate to ~1 to 2 m (it is what the raster decoder is calibrated against);
  2. elsewhere the TINITALY 10 m DEM (`tools/dem.py`, WCS GetCoverage, one 21 MB float32 GeoTIFF in `data/dem_tinitaly/`). TINITALY is a
     triangulated surface (visible facets, rms ~12 m against lidar on the steep east face, +9 m high on average), so near the lidar the
     difference (lidar minus TIN) is smoothed over 40 m and added to the TIN, fading out 200 m from the lidar;
  3. the manifest far grid nodes in the hills are the TIN averaged over each 100 m cell (same blend), so distant Pellegrino matches.
  Tiles with hill data get a 10 m `near` grid (before: lidar belt only), so Monte Pellegrino, Capo Gallo, Monreale and Billiemi have a
  10 m ground and the road-bench shaping in `world.js` works from real heights. Everything is a function of position on a padded
  lattice, so adjacent tiles agree on the shared border.
- **Sources and licences.** TINITALY/01 v1.1, INGV (Tarquini et al.), CC BY 4.0, https://doi.org/10.13127/tinitaly/1.1 (WCS
  http://tinitaly.pi.ingv.it/TINItaly_1_1/wcs). Lidar: Ministero dell'Ambiente e della Sicurezza Energetica, Geoportale Nazionale,
  PST-A lidar Regione Sicilia, CC BY 4.0 (GetFeatureInfo of the same WMS the rasters come from). Credits are in the manifest
  (`credits.hills`), `assets/CREDITS.md` and the README.
- **Rebaking without disturbing a served tree.** `tools/.venv/bin/python -I tools/tiles.py --publish` bakes into `data/world_stage/`
  and then copies only the tiles whose bytes changed plus the manifest into `world/`, every file through a temp name and `os.replace`.
  `--out DIR` bakes elsewhere, `--publish-from DIR` installs an existing stage, `--tiles i_j,i_j` (with `--out`) bakes a few tiles for
  debugging. A stage can be tried in the game with `?worldurl=/data/world_stage/` before publishing. Never run `tiles.py` bare
  while the game is served: it empties `world/tiles/` first.

## Ground update (see docs/faithfulness/ground.md)

- bbox is now south 38.045, west 13.235, north 38.230, east 13.455 (the whole comune, 1119 tiles).
- `areas[].k` also has `scrub, grass, rock, farm, orchard, cemetery, rail, dirt, pitch` (terrain tint only).
- `roads[]` carry `o` (one-way 1/-1), `l`, `ms`, `j` as in bake.py, plus `cw` (real carriageway width).
- Full-detail tiles build a `paint` part (`roadMarksIter` in src/streets.js: lane lines, edge lines, zebras), skipped inside the centro AOI.

## Footprint gap filling and survey heights (done, see docs/sources/comune-ctc-buildings.md)

The second footprint source is the Comune's Carta Tecnica Comunale (Unita' Volumetriche, 2013). `tools/footprints.py` writes `data/footprints_osm_heights.json`
and `data/footprints_extra.json` (git-ignored); `parse_buildings` in `tools/tiles.py` reads both when they exist:

- Extra buildings (1,526; the ones with lidar get the lidar roof) go through the normal `add()`.
- OSM buildings with no lidar roof (48,368) and the extra ones without one take the survey's eave elevation `r`, foot `g`, `h = r - g` and `parts`/`split`,
  the same fields a lidar building has, so `applyDistrictHeights` leaves them alone and the world uses absolute elevations like it does for lidar.
  They also carry `e: 1` (eave): a pitched roof in `emitSolid` (src/buildings.js) then stands on top of the eave instead of eating into it.
  A lidar roof always wins.
- Microsoft footprints were not used (at most 1 % of land in three districts). Overture was not used.


## Street surfaces (data/road_surfaces.json, docs/sources/comune-road-surfaces.md)

`streets_for_tile` in `tools/tiles.py` no longer paves "everything within 24 m of a building" (`URBAN_REACH`, kept only as the fallback when
`data/road_surfaces.json` is missing). With the file, per tile:

- `asphalt` = the Comune carriageway polygons clipped to within `RS_SLACK` (2.5 m) of an OSM road line (half its width), plus motorway shoulders;
  `src osm` carriageways cover the roads the Comune lacks. Tunnels are cut out (the Comune polygons include them) unless a surface road crosses.
- `raised` (sidewalk slab, kerb height, the raised-ground mask) = the pavement bands, plus the parts of a Comune polygon far from any OSM road line
  (medians, promenades: Viale della Liberta is one polygon). Widths are the script's rules per class (1.5 to 3 m).
- `verge` (new layer, flat, dry-grass texture, counts as hard ground) = the band beyond the pavement where no building stands.
- `paving` = plazas (carriageway far from roads), the 2016 decree list of pedestrian streets, OSM-only pedestrian streets outside the Comune
  polygons, `footway` buffers, and OSM `area=yes` pedestrian squares. Via Maqueda is asphalt with kerbs (not decreed).
- Everything else near buildings is private land (courtyards, lots, gardens) and is now terrain. `curbs` run where asphalt meets raised or green.
- Outlines are simplified 0.2 m. The park footpaths and stairs of dataset 281 (`pedestrian_areas`) are not drawn yet.
- `src/main.js` no longer ORs the baked centro slab (`D.streets.raised`) into the raised mask.

### Pedestrian streets: OSM highway=pedestrian wins (tools/tiles.py `PED_STREETS`, `ped_roadlike`)

The 2016 decree list is incomplete, so every OSM `highway=pedestrian` way (not `area=yes`) turns the Comune platform within `RS_PED_REACH` (8 m) of its line
into stone `paving`, wall to wall: no asphalt, no kerbs, no pavement bands (paving is flat and hard ground, so cars still drive on it; the road graph and the
pedestrian mask are unchanged and the crowd walks on paving). Where the Comune has no polygon the way's own width (7 m) is the zone. Two kinds of OSM
road stay asphalt inside such a zone: every ordinary OSM road (cross streets and the like, `keep` lanes), and pedestrian ways OSM also tags as a road
with traffic (`ped_roadlike`: `psv=yes`, a `lanes` tag, `maxspeed` of 30 or more or `IT:urban`, or `sidewalk=both/left/right/yes`). `RS_PED_ASPHALT` lists
names to force back to asphalt (empty). The bake log prints the lists below.

Drawn as paving (way lengths in m, 20.4 km in all; the 6.3 km of unnamed ways are short links and squares): Via Maqueda 1391, Via Vittorio Emanuele 1020,
Via Ruggero Settimo 356, Viale Regina Elena 351, Piazza Giuseppe Verdi 284, Via Bara All'Olivella 270, Via Pietro Novelli 266, Via Bandiera 260,
Via Principe di Belmonte 259, Via Giovanni Battista Pagano 248, Piazzetta Bagnasco 242, Via Principe di Granatelli 227, Discesa dei Giudici 219,
Piazza Sant'Oliva 218, Via Schiavuzzo 187, Via Generale Magliocco 186, Via Rosolino Pilo 182, Piazza Antonio Zanca 177, Via Bottai 167, Piazza Ruggero Settimo 166,
Piazza Castelnuovo 165, Via Francesco Riso 164, Piazza San Domenico 157, Via Merlo 157, Via Orologio 151, Piazza Domenico Peranni 147, Via Giovan Battista Guccia 146,
Discesa Maccheronai 139, Piazza Marina 137, Via Castrofilippo 135, Via Alessandro Paternostro 119, Via Pantelleria 119, Piazza Vittorio Emanuele 115, Via Monterey 111,
Via Monteleone 107, Via Emerico Amari 106, Vicolo dei Corrieri 105, Via Roma 105, Via Ruggero Mastrangelo 105, Vicolo Palagonia all'Alloro 105, Piazzetta Porta Reale 98,
Via Di Stefano 97, Vicolo Castelnuovo 95, Vicolo della Neve all'Alloro 92, Via dello Spasimo 92, Vicolo Teatro Bellini 92, and 50 shorter ones (under 90 m each).

Stay asphalt although tagged pedestrian (road-like): Via Emerico Amari 388, Via Vittorio Emanuele 334, Via Matteo Bonello 167, Via Benedettini 127,
Corso Vittorio Emanuele 117, Via Isnello 55, Corso Calatafimi 48.

What the tags say for the two streets asked about (checked in `data/city/pbf_hwy_*`, nothing guessed):
- **Corso Vittorio Emanuele, Quattro Canti to the Cattedrale** (named Via Vittorio Emanuele in OSM there) is a chain of `highway=pedestrian` ways with different
  tags. From the Cattedrale towards the Quattro Canti: the first ways (about x -565 to -486) have `psv=yes`, `lanes=2` or `sidewalk=both` and `maxspeed=50`: asphalt;
  the stretch around x -440 to -340 has only `motor_vehicle=no/permit`: paving; from about x -247 to the crossing `sidewalk=both`: asphalt again. So the street changes
  surface three times along its length, as the tags do. A way tagged `highway=pedestrian` + `psv=yes` + `lanes=2` is a bus street, not a promenade.
- **Via Vittorio Emanuele near Porta Felice**: the pedestrian way there (`motor_vehicle=permit`, `lane_markings=no`, no psv) is paving; its neighbours are
  `highway=residential`, `lanes=2`, ZTL: asphalt.

Doubt for the owner: every one of these ways, Via Maqueda included, carries `surface=asphalt` (not `paving_stones`), and `vehicle=permit` in the ZTL; the 2021 Mapillary
photos (docs/faithfulness/survey/mapillary.md, finding 8, `ce04 ce05 ce27`) show Via Maqueda south of the crossing as an asphalt road with a white edge line and
kerbs. The rule above follows the owner's instruction (highway=pedestrian is stone), not those tags. To put Maqueda back: `RS_PED_ASPHALT = ("Via Maqueda",)` and rebake.
