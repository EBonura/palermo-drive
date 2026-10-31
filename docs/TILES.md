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
