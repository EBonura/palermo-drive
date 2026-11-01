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

### Pedestrian streets: OSM highway=pedestrian, decided by the real surface (tools/tiles.py `PED_STREETS`, `ped_roadlike`, `PED_STONE`)

Owner rule: "whatever is in real life". Every OSM `highway=pedestrian` way (not `area=yes`) is looked at one by one:

- `ped_roadlike(tags)` (OSM also tags it as a road with traffic: `psv=yes`, a `lanes` tag, `maxspeed` of 30 or more or `IT:urban`, or `sidewalk=both/left/right/yes`): asphalt road.
- `surface=asphalt`: asphalt carriageway with kerbs and pavements, built like any road (the Comune carriageway near the OSM line, pavement bands, and what is left of the
  platform within `RS_PED_REACH` (8 m) of the line becomes pavement, so the street is wall to wall). Via Maqueda is this case; Mapillary 2021 (`ce04 ce05 ce27`) agrees.
- `surface=paving_stones / sett / stone / cobblestone / unhewn_cobblestone / granite`: stone `paving` wall to wall (the Comune platform within 8 m of the line, or the
  way's own width where the Comune has no polygon), flat, no kerbs, no pavement bands; cars can drive on it, the crowd walks on it.
- No `surface` tag, or another one (`compacted`, `concrete`, `fine_gravel`, `paved`): stone paving too (the pedestrian rule), listed separately in the bake log.
- The 2016 decree list (`pedestrian` layer of road_surfaces) still paves its streets, unless an `surface=asphalt` way runs through them.
- In any stone zone every ordinary OSM road (cross streets, bus lanes) keeps its asphalt lanes. `RS_PED_ASPHALT` forces names to asphalt (empty).

The bake log prints the lists (way lengths in m). Asphalt because of `surface=asphalt` (5.8 km): Via Maqueda 1391, Via Vittorio Emanuele 1020, Via Ruggero Settimo 356,
Viale Regina Elena 298, Via Principe di Granatelli 186, Via Rosolino Pilo 182, Piazza Ruggero Settimo 166, Via Pietro Novelli 164, Piazza Domenico Peranni 147,
Via Giovan Battista Guccia 146, Via Emerico Amari 106, Vicolo dei Corrieri 105, Via Roma 105, Piazzetta Porta Reale 98, Cortile Acquasanta 82, Via San Marciano 79,
Piazza Castelnuovo 75, Chiasso Collegiomaria 66, Via Matteo Sclafani 64, Via Ernesto Paci 63, Via Giuseppe Mazzini 62, Via Giusto Ferraro 58, Via Quintino Sella 53,
Piazza Borsa 51 and smaller. Asphalt because of road tags (1.3 km): Via Emerico Amari 388, Via Vittorio Emanuele 334, Via Matteo Bonello 167, Via Benedettini 127,
Corso Vittorio Emanuele 117, Via Isnello 55, Corso Calatafimi 48.

Stone with a stone `surface` tag (`paving_stones` 3.4 km, `sett` 3.3 km, `unhewn_cobblestone` 0.2 km): Via Principe di Belmonte, Piazza Giuseppe Verdi, Piazzetta Bagnasco,
Via Generale Magliocco, Piazza Vittorio Emanuele, Vicolo Palagonia all'Alloro, Discesa dei Giudici, Via Azalea, Via Simone di Bologna, Via Giovanni Lucifora, Piazza Sant'Anna,
Via dell'Immacolatella, Via Sant'Anna, Via Alessandro Paternostro, Via Antonio Montinaro, Via San Vigo, Via Giorgio Montisoro, Vicolo Valguarnera, Piazzetta Delle Dogane,
Piazza Croce dei Vespri, Via Bara All'Olivella, Via Bottai, Via Francesco Riso, Piazza San Domenico, Via Merlo, Via Orologio, Discesa Maccheronai, Piazza Marina, Via Castrofilippo,
Via Monterey, Via Monteleone, Vicolo Castelnuovo, Via dello Spasimo, Via Chiavettieri, Via Piccola Teatro Santa Cecilia, Salita Santa Caterina, Via Principe di Resuttano,
Piazza All'Olivella, Piazza di Resuttano, Piazza Carlo Maria Ventimiglia, Piazza Aragona, Vicolo Gulì, Via Spinuzza, Vicolo della Neve all'Alloro, Via Pantelleria.

Stone by the pedestrian rule, no `surface` tag (6.2 km, 3.4 km of it unnamed short links and squares): Via Bandiera, Via Giovanni Battista Pagano, Piazza Sant'Oliva, Via Schiavuzzo,
Piazza Antonio Zanca, acquedotto storico, Via Ruggero Mastrangelo, Via Di Stefano, Piazza Castelnuovo (part), Piazzetta del Noviziato, Vicolo Teatro Bellini, Via Tavola Tonda,
Vicolo Santa Chiara, Cortile Lo Verde Zisa, Piazza Sett'Angeli, Vicolo Tunisi, Viale Regina Elena (part), Vicolo Bara sulle Mura Dell'Itria, Via Magnisi, Vicolo Cacciatore,
Via Eroi e Martiri di Nassiriya, Cortile Due Palme, Piazza San Pio. Another surface tag (`compacted` 1.0 km, `concrete` Passaggio P.L.1, `fine_gravel` 0.2 km, all unnamed or a passage): stone.

Corso Vittorio Emanuele (named Via Vittorio Emanuele in OSM between the Quattro Canti and the Cattedrale) is a chain of pedestrian-tagged ways: the ones with `psv=yes`,
`lanes`, `maxspeed=50` or `sidewalk=both` are road-like asphalt, and the rest say `surface=asphalt`, so the whole stretch is asphalt. Near Porta Felice the pedestrian way
(`motor_vehicle=permit`, `surface=asphalt`) is asphalt like its residential neighbours.

## Bridges, viaducts and tunnels (tools/structures.py, src/bridges.js)

Audit of what was there: `tiles.py` baked only a `br`/`tn` flag on the road (nothing was extracted for waterways, barriers or `man_made=bridge`), the road was draped on the
ground model, so a bridge was a strip of asphalt on a smooth far-grid hill (no deck, no parapets, no piers, no river, no trench), tunnels were removed from the street layers and
the hill covered them, the car followed the terrain only (one height per x, z), and traffic ignored all of it. `computeShape` also skipped `br` and `tn` roads.

Now (city-wide, from OSM `bridge=yes|viaduct|movable|aqueduct`, `tunnel=yes`, `layer`; culverts, `building_passage` and structures under 12 m (tunnels 20 m) are skipped):

- **Data.** The PBF cache has two new categories: `wtr` (waterway river, stream, canal, drain, ditch, brook: 63 ways) and `bar` (barriers, for the walls step). `tools/structures.py`
  writes one record per structure into `tile.structs` of every tile it touches: `{id, k 'b'|'t', p centreline, w deck width, cw carriageway, ly layer, n, hw, ow, f, rv river lines
  within 200 m, rw river width, rf per river vertex the lowest ground across the valley floor (rv is then cut into pieces of about 8 m), dep metres from the deck to the river bed, ov flyover, y0, y1}`. `dep` is relative (TINITALY valley depth: shoulders at the ends minus the bed under the
  deck), `y0`/`y1` are the ground heights at the two ends as the game will show them (tile near grid, else far grid), written after the tiles are baked (`add_heights`). 191 bridges
  (43 over water, 54 flyovers), 84 tunnels. Street layers lose the ground under water-crossing decks (`cut`), so no road is draped in the trench.
- **Runtime** (`src/bridges.js`, wired in `src/world.js`): per structure, one copy by id. At tile parse: the deck or tunnel floor becomes a *level* (`hooks.level(x, z, yRef)`, the highest
  surface not more than a step above yRef), the river trench and tunnel cuttings are carved into `hooks.ground` (`carve`; terrain cells are 5 m on tiles that have a trench), parapets
  and tunnel walls go into the wall grid tagged with their height (`seg.lv`: they only stop a car on that level; the camera, traffic and sight lines ignore them). At full detail: deck slab,
  asphalt with edge and centre lines, kerbs, pavements, parapets, piers every 30 m, abutments; the river (bed strip and water) under a bridge; tunnel floor, lining and ceiling.
  Deck heights are linear between `y0` and `y1`; a flyover climbs 5.4 m with 28 m ramps; a long viaduct never goes under the ground; a tunnel under a hill is level, one under flat
  ground dips so that the ground is a roof everywhere (4 m steps, ramps at 10 %), with an open cutting at the mouths.
- **Cars.** `car.deck` is the height of the deck or floor above the terrain (negative in a tunnel); `car.lift` includes it, so everything that adds `lift` to `groundY` (missions, mounts)
  follows. Both driving models use it (`src/vehicle.js` classic, `src/vehicle-sphere.js`); driving off a deck is a free fall; the camera stays above the deck and under a tunnel roof.
  Traffic on a road flagged `br` (graph edges carry it) is placed on the highest deck; pedestrians do not walk on decks (the street layers are cut there).
- **Not done:** rail bridges (railways are not extracted), a `man_made=bridge` footprint, lamps and lane paint on tunnel floors, pedestrians on decks, tunnel portal frames,
  `layer` stacking beyond two levels at one point.

### The Ponte Corleone and the secret "Bba ieccati ru baby luna"

Baby Luna is the bar of OSM way 81030476 (`amenity=bar`) at game (-1565, 2818), at the Ponte Corleone, also called Ponte Oreto, which carries Viale Regione Siciliana over the Oreto river
(PalermoToday and Giornale di Sicilia name the bar and the bridge together; one article calls the same bridge "ponte Oreto"). It is two OSM ways with `bridge=yes`, `layer=1`, 145 m each:
`81030481` (-1414, 2894 to -1522, 2795) and `81030484` (-1531, 2805 to -1425, 2903), ids `b81030481` and `b81030484`, 36 to 49 m from the bar. The Via Oreto street has its own, different
bridge further east (`b828370088`, 153 m at about 750, 1450). The river is the OSM `waterway=river` line, 14 m wide, 12.6 m under the deck (TIN valley depth), with a carved trench and water.

Trigger: `LANDMARK_ZONES` in `src/bridges.js` (`{ id: 'baby-luna-jump', structs: ['b81030481', 'b81030484'], minFall: 4, jump: true }`). The parapets of those two decks can be vaulted: speed
over 11 m/s and 4.5 m/s straight into the parapet and the car goes over (`seg.jump`; every other parapet in the city stays solid). The event fires once per fall, when the car has dropped
`minFall` metres within 6 s of leaving the deck, as `window` event `pd-landmark` with `detail = { id: 'baby-luna-jump', label, x, z, y, fall }`, and to the listeners of
`onLandmarkEvent(fn)` (exported by `src/bridges.js`, returns an unsubscribe function). An achievements module only has to listen for `pd-landmark` and check `detail.id`.

## Walls and fences (tools/fences.py, src/fences.js)

Audit: `tiles.py` extracted no barrier ways at all (only bollards and lift gates as props), so every garden wall, parcel wall, fence, retaining wall and the city walls were missing
from the map; the Regione Siciliana CTR lines (`data/walls.json`) were prepared but unused.

- **Sources, merged per tile** (`tile.fences = [{k, h, s, p}]`): OSM `barrier=wall|retaining_wall|city_wall|fence|guard_rail|jersey_barrier` (new cache category `bar`: 2,802 lines, 118 km of
  walls, 50 km of fences, 28 km of retaining walls; hedges, chains and gates are not drawn, hedges belong to the greenery step) and the CTR lines (46,063 lines: wall `w`, dry-stone `d`,
  retaining `r`, fence `f`). A CTR line is kept when it lies within 20 m of a carriageway (`st`) or within 30 m of a building (the rest are field boundaries, 3,300 km), is dropped where
  an OSM barrier is within 3 m, and is cut away on building outlines (0.6 m), on the carriageway and under bridge decks. The ground truth of the CTR is 2003 with a 2012 patch at 1:10,000.
- **Heights and materials** (the CTR has none): OSM `height` when tagged, else wall 1.8 to 2.6 m, dry-stone 1.0 to 1.5 m, fence 1.3 to 1.8 m, guard rail 0.75 m, concrete barrier 0.8 m,
  city wall 5.5 to 7 m; a retaining wall is as high as the ground differs on its two sides (plus 0.3 m, at least 1.4 m). Walls are vertex-coloured limestone and plaster tones, 0.35 m
  thick (0.55 dry-stone, 0.5 retaining, 1.3 city wall); fences are 2.5 m panels with an alpha-tested texture: railing (dark bars), wooden, or mesh (OSM `fence_type` decides, else a hash).
- **Runtime** (`src/fences.js`, wired in `src/world.js` buildFull and downgrade): per full tile one merged wall mesh plus at most three instanced fence meshes (at most 1,400 panels a
  tile, OSM first). All pieces go into the wall grid, so cars, traffic and pedestrians are stopped by walls and by intact fences. Walls are solid at any speed.
- **Fences break.** The two collide() functions (`src/vehicle.js`, `src/vehicle-sphere.js`) ask `hooks.breakFence(seg, speedIntoIt, nx, nz, car)`: at 3 m/s and more the panel is smashed (it
  flies off as a spinning piece, ten in the air at a time per fence style, gone after six seconds), the car loses a fifth of its speed into the fence, window event `pd-fence` fires, and the
  gap stays open for the session (`broken` ids survive a tile reloading). Slower, a fence is a wall. `hooks.tick` moves the flying pieces from the same physics step. `?nofences` hides
  all of it (debug).
- **Not done:** gates (OSM `barrier=gate`) are left open, hedges are in the greenery step, wall textures are flat colour, and pedestrians do not react to a smashed fence.

## Trees, hedges and Comune green (tools/greenery.py, tools/fences.py, src/props.js)

- **Trees.** `data/trees.json` (lidar crowns, CTR points, the Urban Atlas lattice) goes into each tile's `props.items` as `{k: 'tree', x, z, r?, h?, kd?}` and is placed by the existing
  props generator (not on a road or a building, breakable like the OSM trees). Kept: lidar and CTR trees up to 320 a tile (biggest crowns first), the Urban Atlas lattice thinned to one tree
  per 36 m cell and at most 90 a tile (126,159 invented positions become about 16,000), trees inside an OSM forest or scrub area are left to the forest instancing. 41,250 trees in 880 tiles.
  `kd` picks the model (tall: palms, fruit and citrus: orange tree, olive: grey-green broadleaf, pine), `r` and `h` scale it to the measured crown; 135 OSM trees got a crown radius and height
  from the lidar (`data/trees_osm_crowns.json`).
- **Hedges** (OSM `barrier=hedge` and CTR siepi, 810 lines) are green solid blocks 1.0 to 1.8 m high in `src/fences.js` (kind `h`).
- **Comune green** (`data/verges.json`, 2,090 polygons): in `streets_for_tile` every class is drawn as the `green` layer (grass at kerb height, the car bumps up onto it); medians and islands are cut out
  of the asphalt first, since the Comune polygons win over the road derived from the street survey (Viale della Liberta's medians are real grass strips now).
- **Not used:** `data/tree_rows.json` (the rows are made of trees already in `trees.json`) and `data/veg_areas.json` (only its class survives, as `kd` on a tree).

## Transit: buses, tram, fountains (tools/tram.py, tools/transit_bake.py, assets/traffic/bake-bus.cjs, src/trams.js)

- **Buses.** `assets/traffic/bake-bus.cjs` now reads `data/bus_routes.json` (AMAT GTFS, 67 routes) instead of the OSM relations: the busiest pattern of each direction (132 patterns, shapes
  thinned to 2 m), so the 27 routes OSM lacked run, including the 806 to Mondello (and N1 to N7, 516, 606 ...); the OSM relations stay as the fallback. Stops: all 1,594 GTFS stops plus the OSM bus
  stops more than 8 m from one (the buses' stop list). 481 GTFS stops have no OSM stop within 40 m and become named `busstop` props in the tiles. `bus-routes.js` shrinks from 317 to 226 KB.
- **Tram** (data/tram.json: OSM tracks, AMAT stops and timetable, 4 lines, 93 track chains, 74 stops): per tile `tram = {r rails, s stops with platform line, o poles}` and the railing in
  `fences`. `src/trams.js` draws the rails (a ballast strip with two rails, above whatever street layer the track lies in), the platforms with glass shelters and benches, dark red catenary
  poles (instanced) and the wire (one line mesh over every track not in the carriageway), and runs the trams: three articulated modules following the line path, as many trams per direction as the
  headway asks for (at most five, 12 in all: L1 3.1 min, L2 to L4 about 6.5 min), slowing to every stop, 9 s there, and starting the other way at the end of the line. They are solid: the lapa
  bounces off a module (circle test in `hooks.fall`) and a tram brakes for a car on the track within 14 m ahead.
- **Design values, not data:** the catenary pole spacing (30 m, on the median between a pair of tracks, else 2.3 m beside the track) and the railing (1.1 m black iron railing, 1.9 m outside each
  rail on median and roadside stretches, gaps at stops, crossings and between the two tracks): OSM and the GTFS have neither, the Mapillary photos only show the look. Tram speed 9 m/s is a game value.
- **Fountains.** `water` props (OSM `drinking_water`, 130 nodes, which were baked but never drawn) are now a green cast-iron fontanella on the pavement; the Comune list adds the 150 entries
  that have no OSM node within 25 m (fontane use the existing fountain model).
- **Not done:** trams do not run on the title screen, no tram sound or bell, the platform shelters are plain, pedestrians do not board, `data/tram.json` stretches `street` (tram in the carriageway)
  are only 0.2 km so no mixed traffic handling, trams have no headlights.

## Roof and ground colours (tools/colours.py; docs/sources/sitr-orthophoto-colours.md)

Only colour values derived from the Regione Siciliana SITR orthophotos (ATA 2012-13) are used; no imagery is stored, copied or embedded.

- **Roofs.** `rc` ("rrggbb", chroma pulled in 15 % because the picture shows sun-lit surfaces, not albedo) on the 62,448 buildings whose confidence is 0.35 or more; the other 19,500 keep the zone
  palette. The runtime (`src/buildings.js`) puts the colour on the roof as a tint over the roof texture: flat roofs use the plain terrace texture, pitched ones the grey tile texture, so the colour
  is the photo's and not terracotta unless the photo says so (churches, industrial sheds, ruins and beach buildings keep their own); the low-detail ring (`src/world.js`) uses the same colour and
  `tools/farcity.mjs` mixes it half and half into the far boxes. The median roof is dusty tan (176, 167, 152); ZEN and the new quarters come out concrete grey.
- **Ground.** `gt = {t, a}` per tile (932 tiles): two 25 x 25 grids of 20 m cells, two hex digits a cell (lightness, warmth, 88 = neutral), `t` for terrain (courts, bare ground, green) and `a`
  for hard surfaces (asphalt, paving, pavement), both relative to the city median of their group. Applied bilinearly as a multiplier on the terrain vertex colours and on the street layers' vertex colours
  (`tintFn` in `src/world.js`, `opts.tint` in `src/streets.js`): a relative tint, it varies what the game already draws. Cells seen only in shadow are neutral.
- **Caveats:** the photos are 2012-13 (about 13 years old); outlines and photo disagree by metres; the ground classes of the orthophoto data were computed on the street layers before the Comune
  streets (`court` is now plain terrain), which only matters as a relative tint.

### Ground outside the lidar (t8)

The near and far grids use TINITALY everywhere and pin it to the lidar and to the Comune survey's building foot elevations (hold-out error 2.9 m rms against 6.9 m before; details in docs/faithfulness/terrain.md).
Bridge decks, tunnel floors and the river trenches follow automatically (their end heights are baked from the same ground); the Ponte Corleone valley is the real 12 m deep one.
