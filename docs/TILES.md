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
  - `er[]`: the drivable roads of the neighbouring tiles clipped to the 20 m just outside this one (same fields, fewer of them; only in tiles with walls).
    Only the roadside-wall rules read it (`src/fence-walls.js`, so a wall at the tile edge knows the road next door); everything else reads `roads`.
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
- **After a rebake: the wall tags.** The 800 SUCA and 800A tags (src/suca.js) are baked from the tiles' footprints and roads into
  `src/suca-tags.js`. Run `node tools/suca-bake.mjs` after publishing new tiles (a few seconds; it prints the tags per district tier and
  how many saved ids carry over) and commit the new file; `node tools/suca-bake.mjs --check` only says whether every baked tag still sits on
  its wall. A tile whose tags lost their walls also says so in the console (`[suca] tile ...`) when it loads. Needs tools/build/node_modules.

## Ground update (see docs/faithfulness/ground.md)

- bbox is now south 38.045, west 13.235, north 38.230, east 13.455 (the whole comune, 1119 tiles).
- `areas[].k` also has `scrub, grass, rock, farm, orchard, cemetery, rail, dirt, pitch` (terrain tint only).
- `roads[]` carry `o` (one-way 1/-1), `l`, `ms`, `j` as in bake.py, plus `cw` (real carriageway width) and `pk` (parking lanes, two characters: left and right of the way direction; `p` parallel, `q` perpendicular, `d` diagonal, `n` none, `-` not said; from the OSM `parking:lane:*`, `parking:*`, `parking:condition:*` and the old `parking:lane` tags, `tiles.parking_lanes`; only 19 ways of Palermo carry any, 28 road records).
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
- **No kerb where the street has none (n6).** The part of a Comune carriageway polygon beyond the OSM lanes (`island`) used to become `raised` everywhere. It no longer does on a road
  that has no pavement: OSM `sidewalk=no|none` (or `sidewalk:left` and `:right` both no), beyond `NOKERB_R` (inside the old town the survey wins: Via Argenteria Vecchia is tagged no and has a pavement), removes both that excess and any Comune pavement polygon within the road's reach (`nko_*` in `G`),
  and a residential, service, track, unclassified or living_street road that OSM does not tag `sidewalk=yes|both|left|right|separate`, beyond `NOKERB_R` (2.5 km) from Quattro Canti, keeps
  no excess either (`nkc_*`, per 60 m chunk) unless buildings fill at least `FRONTAGE` (25 %) of a 16 m strip along it (a built frontage means the survey's carriageway includes the pavement).
  Comune pavement polygons far from a `sidewalk=no` road are trusted as they are. `sw` is bake-time only (not written to the tile roads).
- **Medians of dual carriageways (n2, `tools/medians.py`).** Pairs of one-way OSM ways of the same name, 3 to 45 m apart and running opposite ways, give the strip between their centre
  lines (cross sections every 6 m, dropped when another road crosses them or the free gap is over 22 m). Free gap under 4.5 m: the `median` streets layer, a concrete kerbed strip at kerb height (in the raised and hard-ground masks for the car, not walkable for pedestrians, no street furniture). Wider: a
  planted strip (`green`, kerb height), only where the survey draws neither a pavement nor a verge. Guard rails and jersey barriers come from the OSM `barrier` ways in `tools/fences.py`
  (kinds `g` and `j`) as before; nothing is invented. Where the Comune polygons already draw the median (Viale Regione Siciliana at Brancaccio) nothing changes.
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
- **Flyovers and what runs under them** (`oc`, `ud`; tools/structures.py, src/bridges.js). `oc` is the list of metres along the deck where a road passes under it; a flyover with `oc` is lifted only around those
  points (9 m of plateau, 36 m of ramp each side, never steeper than the end ramps) and follows the ground elsewhere, with piers away from the crossings, so a 250 m interchange ramp is no longer a slab 5 m above
  a field. `ud` has, per crossing, the lower road's line (8 m vertices, 56 m each side, carried straight on past the end of its way) and the ground under it: that road sinks 2.7 m under the deck (a terrain channel
  of kind `dip`, level where it is under the deck, back to the ground over 42 m) and the deck climbs 5.4 - 2.7 m. It is only baked where the lower road passes at least 8 m (plus half its width) from both
  ends of the deck, because a dip that reached the approach road would leave the deck end in the air; the short flyovers (under about 60 m: Via Nazionale at Isola delle Femmine, the Piazza Di Salvo ring) keep the full 5.4 m climb.
  Parapet colliders: none within 12 m of a flyover end until the deck stands 1 m above its starting line (roads join the ring of Piazza Einstein right at the bridge ends), and none where a parapet would stand
  in the lane of another deck within 2.6 m of its height (ramps that merge or part: the four ramps of the Isola delle Femmine interchange could not be driven because each one's parapet crossed the next one's lane).
  Tunnel ways: `tunnel=yes` shorter than 20 m that run under a bridge, and `covered=yes` on a motorway, trunk, primary, secondary or tertiary road (the open cutting of the Viale Regione Siciliana under
  Piazza Einstein, 543 m), are ordinary surface roads in the bake; they used to be flagged `tn` (dropped from the street layers and from traffic) without ever getting a tunnel record, so the road was missing.
  `covered=yes` on a residential or service way is a passage through a building and stays a `tn` way.
- **Roads over tunnels** (`xc`, `xg`, `ap`; tools/structures.py, src/bridges.js). A short underpass dipped only in its middle, so the cutting at its mouths took away the ground of any road crossing
  over it off centre: 49 crossings over 28 tunnels stood over a 2 to 7 m trench (the Viale Regione Siciliana over Via Emily Balch at x -1300, z 3016, where the car fell in and stuck; the motorways over
  the underpasses of Via De Gasperi, Viale Leone, Via Kennedy and the Raccordo per Via Belgio). The bake now gives every tunnel the surface roads and squares that cross over it (`xc`: metres along, width),
  the lowest ground round each (`xg`, add_heights) and the road out of each mouth (`ap`: 80 m outward, following the joined ways, stopping at the next tunnel's mouth). The runtime keeps the floor
  `TUN_COVER` + 0.5 m under every such road, level across it, climbing back at 10 %; where that leaves a mouth below the ground, the ramp down is cut along `ap` outside the mouth (OSM's tunnel way is
  the covered part), and where a road over a mouth is wider than the tunnel way reaches, the tunnel is carried on under it. A tunnel floor no longer counts as a level for anything above its ceiling,
  so a car on a road over a covered tunnel stays on that road (it used to snap down to the tunnel floor). The tiles got only these fields (a script wrote them into the committed tiles from the
  bake's own code); 9 tiles that the ramps reach got the tunnel record.
- **Tunnel cuttings and portals** (`pg`, `ag`; tools/structures.py tunnel_ground, src/bridges.js cutPath). Where a tunnel's floor goes under the ground, the cutting was the terrain carved
  at 45 degrees (3:1 along a ramp) on a 2.5 m grid: from the road below the mouth was a band of tilted triangles from the floor to the top, over the opening as well, and the street layers and
  fences beside it hung down into it. The bake now gives every tunnel the ground along its line every 4 m (`pg`) and under every vertex of the roads out of its mouths (`ag`), so the runtime
  tells the open cutting from the covered part the same way whichever tiles have loaded (and the dip of a flat underpass no longer depends on them either). The cutting is walled: within its
  retaining walls (on the line of the tunnel's lining, 0.5 m thick) the ground is the floor, outside them it is untouched. At full detail the terrain mesh is cut away exactly along the walls
  and keeps its own ground up to them, the street layers' triangles are split along them (each piece draped on its own side), and walls and fences that ran into a cutting keep only their
  parts outside it. The tunnel's mesh draws the retaining walls with their coping (a parapet up to 1 m over the ground beside a deep cutting), the floor of the ramps, and over every
  portal two piers, a lintel and a concrete headwall up to the ground and its parapet. The tiles got only these two fields (a script ran the bake's tunnel_ground on the committed tiles).
  The concrete is textured (`src/wall-tex.js`, layer `t` of the wall texture array, `concreteMaterial`): cast in place, lifts of 1.2 m with board marks, an expansion joint every 4.8 m,
  tie holes. Its coordinates are metres along the wall, above its foot and below its coping (attribute `aConc`), so the joints keep their spacing and follow the road's grade; the shader adds
  what depends on the wall's height: water streaks from the coping (the layer's alpha, each of its own length), a dirtier foot with damp and moss where the wall meets the road, and a tone per
  pour that drifts along the wall. The portals use the same concrete a little cleaner. One material for every tunnel (it replaced the flat one), so no draw call was added; the layer adds 1 MB
  to the array (1.3 with mips).
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
  tile, OSM first). All pieces go into the wall grid, so cars, traffic and pedestrians are stopped by walls and by intact fences. City walls (`c`) and retaining walls that hold up ground are solid at any speed, so are the walls of buildings and landmarks; the other walls break (below).
- **Fences break.** The two collide() functions (`src/vehicle.js`, `src/vehicle-sphere.js`) ask `hooks.breakFence(seg, speedIntoIt, nx, nz, car)`: at 3 m/s and more the panel is smashed (it
  flies off as a spinning piece, ten in the air at a time per fence style, gone after six seconds), the car loses a fifth of its speed into the fence, window event `pd-fence` fires, and the
  gap stays open for the session (`broken` ids survive a tile reloading). Slower, a fence is a wall. `hooks.tick` moves the flying pieces from the same physics step. `?nofences` hides
  all of it (debug).
- **Walls are textured** (`src/wall-tex.js`, used by `src/fences.js`). One texture array with a 512 px layer per kind, drawn in code from a seeded generator (the same pixels on every device, nothing depends on the
  quality tier): plaster with age stains and a patch of fallen plaster for garden and parcel walls (`w`, 4 x 3 m), irregular stacked stones with dark gaps and moss for dry-stone (`d`, 3.2 x 1.6 m), rough rubble in
  grey mortar for retaining walls (`r`, 3.2 x 2.4 m), big honey-coloured tufa blocks in running bond for city walls (`c`, 3.6 x 2.7 m), board-marked cast concrete with panel seams and tie holes for barriers (`j`),
  leafy clumps for hedges (`h`, 2.4 m) and coping slabs for the top of every wall. The uvs are real metres (along the wall over the layer's width, below the wall top over its height), so nothing stretches and a
  stone course follows the wall over a slope; the courses are scaled to add up to the tile exactly, so the array repeats without a seam. The layer is light, near neutral detail: the wall's own colour (per wall
  variation, the darker foot, the paler cap) still comes from its vertex colour, and two octaves of world space value noise in the shader break up the repeat. The whole tile stays one mesh with one material
  shared by every tile (the draw calls of the walls did not change), and the flying chunks of a broken piece use the same material with an instanced layer, so they carry the stone, plaster or leaf look and the colour of the wall.
- **Walls and hedges break, easily** (`src/fences.js` for the baked kinds `w`, `d`, `h`, `r`, `j`; `src/props.js` for the clipped hedge blocks of the Libertà). A wall is cut in 4 m pieces. The speed that counts is
  the effective speed `hypot(v_into_wall, 0.55 * v_along_wall)`, so a scrape along a wall at speed breaks a piece too, not only a square hit (under sphere handling a glancing hit used to carry only its normal part,
  often far under the threshold). A piece breaks above: hedge 1.8 m/s, dry-stone 3.6, wall 4.0 below 1.6 m high, 5.2 up to 2.2 m, 6.6 above, retaining wall that holds up less than 0.8 m of ground (the ground on its two
  sides differs by under 0.8 m) 5.4, concrete barrier 9.0; fence panels 2.6. Retaining walls that really hold up ground and city walls (`c`) stay solid, so do the walls of buildings and landmarks (counted over every baked tile, with duplicates at tile borders removed: under 1 km; the "118 km of walls" of the first audit were the OpenStreetMap barrier ways only, the Regione's technical map lines add the rest, 1,173 km of `w` were already in the tiles of commit fcf0c0b; the roughly 1,440 km
  of baked wall that is breakable against 61 km that is not: 1,172 km of garden and parcel walls, 202 km of weak retaining walls, 60 km of hedges and 8 km of dry-stone against 60 km of ground-holding retaining wall
  and 1 km of city wall). The piece's quads are collapsed in the tile mesh (the `position` range recorded when it was built), its wall-grid segment leaves every query, and chunks (150 pooled, gone after 4 to 6 s) or,
  for a hedge, a puff of leaves and green clumps (240 pooled) fly away from the car. The car loses 12 % (hedge), 26 % (low wall), 38 % (wall) or 50 % (barrier) of its speed, scaled down for a scrape. The gap stays
  for the session (`broken` ids, a rebuilt tile skips them; the Libertà hedge blocks are remembered by position). Event `pd-fence` `{x, z, kind: 'fence' | 'wall' | 'hedge'}` feeds `police.chaos` (src/traffic.js
  listens; gains 0.08, 0.2 and 0.06, at most one per 0.4 to 0.5 s).
- **Not done:** gates (OSM `barrier=gate`) are left open, the walls have no normal maps, and pedestrians do not react to a smashed fence. The data has no `j` pieces yet (OSM `jersey_barrier` is baked as `j` when it appears).

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
  A stop's platform `a` is the platform line's two ends, drawn 2.6 m wide; Notarbartolo's island is mapped as an area, so its `a` is the long axis of the area's smallest enclosing rectangle
  and `w` its half width (2.9 m). A platform shared by two stops (the island platforms at Notarbartolo, Stazione Centrale and Roccella) is on the first stop only, so it is drawn once.
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

### Off-road driving (board item e6)

**Surfaces** (`src/world.js` `surfaceAt`, `drivePlayer`; `car.surf` for sounds and effects): 0 hard (asphalt, paving, pavements, medians, verges; the street polygons have seams of a few tenths of a metre along hairpins and tile borders, so hard ground within 0.9 m counts), 1 gravel and dirt
(the `track` strips, and every `path`, `footway`, `cycleway`, `bridleway` that is not beside a street (9 m) or among houses (28 m): the paths of the Favorita and the hills; `buildGravel`, per tile),
2 grass (the `green` layer), 3 beach sand (the `sand` layer, a third channel of the 0.5 m surface mask: `t.sandb`), 4 rough ground (scrub, hillside, fields: everything else that is not surfaced).
Each class has `[grip lost, drag per second, bump size, bump spacing]` in `SURF`: gravel 0.22 / 0.06, grass 0.38 / 0.14, sand 0.70 / 0.55, rough 0.50 / 0.20 (grip lost works like a pothole: `car.gripLoss` caps the cornering).
`src/vehicle.js` (one line, in the longitudinal part shared with the sphere model): `aDrive *= 1 - 0.4 gripLoss`, `brakeA *= 1 - 0.5 gripLoss`, so the tyres spin and lock on loose ground (and a little after a pothole).
Measured on 55 m straights (full throttle 2.5 s, then full left at 14 m/s for 1.3 s): top speed 21.6 asphalt, 17.2 gravel, 17.7 grass, 9.6 sand; heading change in the carve 96, 85, 79, 75 degrees (before: 21.6, 17.4, 20.2, 18.8 and 95, 90, 84, 86).

**Monte Pellegrino**: the OSM route from Via Isaac Rabin up Via Pietro Bonanno to the Santuario (9.3 km, 2,879 points every 3 m) and to the Castello Utveggio (6.9 km) is one connected drivable chain (unclassified, 6 m wide, then service roads of 4 m).
An automatic drive (pure pursuit, 5 physics steps a frame, `tools`-free scratch script) completes both ends: Santuario in 635 s of game time, maximum distance from the route 3.8 m, maximum speed 17.9 m/s, ground from 21 to 423 m; Utveggio 476 s, 4.4 m. Both landmarks are there (the Utveggio: the salmon hotel castle with its towers; the Santuario: the ochre convent against the cliff, the road ends at its door).
The only stops are a pedestrian and a pothole cluster at the hairpin at (308, -3990) and the dead end at the Santuario.

**Favorita**: a 689 m path (a `cycleway` in OSM) and a 450 m run straight across the lawn completed without a stop (maximum 4 m off the line, 15 m/s).

**ZEN** (`tools/zen_portals.py`): the OSM footprints close every court of the insulae with a building or a wall, so none of 51 courts of 250 m2 or more (63,000 m2) could be reached. In reality the insulae are entered through ground-floor passages (androni, pilotis),
so each court gets a passage 6.4 m wide cut to the nearest street: the building keeps its upper floors. It is split into the parts left and right of the gap (full height, collision as before) and a bridge volume over the gap, a record with `yb: 4` (the volume starts 4 m above the ground):
`src/buildings.js` draws it from that height and gives it an underside (`tDown`), `src/world.js` registers no walls for it and `src/pedestrians.js` no footprint. Ids get `.1`, `.2` for the parts and `.b` for the bridge. Walls and fences get a 6 m gate gap and nothing more.
60 buildings are cut (37 bridge volumes) in 10 tiles: `-10_-15`, `-9_-14`, `-9_-15`, `-9_-16`, `-8_-14`, `-8_-15`, `-8_-16`, `-7_-14` (walls only), `-7_-15`, `-7_-16`; three fenced lots away from the insulae stay closed. A rebake of those tiles brings the closed courts back: run the script again (`--apply`).
Driven through, both ways, with the automatic driver at 4 m/s: six of the archways (all 12 runs reach the far side once the start is outside the building).

### Paved ground between blocks (review-2 item 4) and the Pellegrino cliffs (item 5)

Ground that the tile data has no polygon for was the pale blotchy terrain of the open country, even in a square or a courtyard. `terrainMesh` (src/world.js `paveField`) builds a 5 m field over the tile and 50 m beyond it from the building outlines of the tile and its neighbours (a tile border shows no seam): the distance to the nearest wall and the share of wall cells within 45 m. A vertex that is close to walls (full from 28 m, none from 70 m) in a crowded quarter (from 6 % to 16 % wall cells), on level ground, outside the Mondello garden region and under no land cover polygon (park, wood, sand, field, scrub, grass) gets a weight in the `aPave` attribute; the terrain shader then blends the street paving texture (`TEX.balate`, worn limestone slabs) over the detail texture and the vertex colour goes light stone. Cost: about 1 ms a terrain build. The Pellegrino rock under the Castello Utveggio and behind the Santuario is built from `crag()` (src/lmc-kit.js, now with an optional closed top and a `rough` jitter) in a grey-ochre limestone texture, rooted down to the lowest ground in front of it so no underside hangs in the air.

Floating strips in the sky (review-2 item 8) were not geometry: the review cameras stood inside building footprints. Walls and roofs are single sided, so from inside a footprint only the cornice undersides and the balcony slabs show.

### Gardens, the station, the bridge and the Mondello piazza (review-2 items 9, 13/14, 15; src/lmc-g.js)

Landmark group G, same toolkit and spec as the other city landmarks. `walls` are fixed at module load (world.js reads them before the model is built), so the planting is decided once (`GI_PLAN`) and the builder only draws it.
- **Giardino Inglese** (the 4.7 ha park on Via Libertà, tile -2_-4): gravel walks (draped strips, lift 0.2 m and polygon offset -6 so they sit over the Comune green polygon), a ring walk round each pond, a bandstand where the pavilion w194087049 stood (skipped), flowerbeds, palms along the main walk and the ponds, five ficus, benches. Collision: bandstand, ficus trunks, palm trunks.
- **Villa Garibaldi, Piazza Marina**: two strangler figs (`ficus()`: buttressed trunk, limbs, crown lumps with a lump on every limb tip, curtains of aerial roots). Collision: the trunk ring. The generic park trees from src/props.js are still drawn under them.
- **Stazione Centrale** (relation r1223249 is skipped): the OSM ring and courtyard as a plain shell, a 78 m front block 15 m deep over the notched front, a central pavilion with the clock and pediment, two end pavilions, balustrade. Front faces north-west to Piazza Giulio Cesare. Collision: the pavilions that stand proud of the footprint.
- **Ponte dell'Ammiraglio** (`PONTE_AMM` replaces `PONTE` of lmc-b): seven pointed arches of irregular rubble on the OSM line, parapets, round abutments, a gravel bed under the arches, stones and agaves. Collision: the piers.
- **Piazza Mondello**: `pave` on a landmark spec is a list of ground polygons; world.js (`PAVEZ`) paves those terrain vertices (full weight, whatever the cover or the garden region says). Kiosks (collision), a kerb round the fountain, lamp posts. San Girolamo is rebuilt with a gabled front, rose window and bell tower (the OSM footprint is 7.7 x 19.6 m).
- The Santuario cliff massifs are now four stacked tiers each (`massif()` in src/lmc-a.js), broad foot and stepped ledges.

### Despiked terrain (owner request: "vertex explosions"; tools/despike.py)

The near grids had isolated nodes and one-column fins on the cliffs, up to 170 m off (the fin at x -30, z -5730 in tile -1_-12 was a column that alternated between 150 and 320 m beside a 250 m face). `tools/despike.py` finds a node whose
residual against the mean of each of its four opposite-neighbour pairs is above 15 m (on a 5 m grid, scaled with the step) in all four directions with the same sign, and runs of at most three nodes along a row or column whose cross residual is above
30 m; the node takes the value interpolated across its smoothest direction, up to six passes. The sea clamp (-1.5 m) and its neighbours are left alone (the edge of the baked area is a real step). A cliff edge or crest is not flagged:
along it the residual is small, a step has residuals of opposite sign. `--apply` patches `world/tiles` (originals to `data/despike-backup/`), and `tools/tiles.py near_for` runs the same function on the padded lattice, so a rebake keeps it.
The 839 nodes of the first run are in 48 tiles, all on Monte Pellegrino, Monte Gallo and the north coast hills; none in the city.

### Sferracavallo (board item b2): already inside the baked area

The bake box (`BBOX_LL` in `tools/tiles.py`, 38.045..38.230 N, 13.235..13.455 E, game x -11,058 m at the west edge) already holds Sferracavallo (OSM place at -7,366, -9,147), its harbour (-7,545, -9,379), Punta di Barcarello (-7,009, -10,559), Tommaso Natale, Isola delle Femmine and Capaci. Tiles `-17_-19` to `-12_-22` carry them with buildings (812 in `-15_-19`), roads (Via Sferracavallo, Via Marina, Piazza Sferracavallo, the Galleria), trees, walls, a 10 m or 5 m near grid with the same lidar and TIN pinning and the harbour piers; the drivable box (`hooks.bounds`, the manifest bbox) and the start map take in the whole box. The drivable road graph (all drivable OSM classes, ends joined at 0.6 m) puts Sferracavallo, Tommaso Natale, Mondello, Isola delle Femmine and Capaci in the one big component. The start picker lists "Sferracavallo (la piazza)" and "Sferracavallo (il porticciolo)" (`POI_SPOTS` in `src/pub-places.js`, appended to `SPOTS` by `main.js`; the quartiere centre "Sferracavallo" in `main.js` names the group).

### Hills outside the first TIN window (t7) and the Pellegrino shade (t6)

`tools/dem.py` now fetches TINITALY for the whole play area (E 869400..892200, N 4218200..4242200), so the 222 tiles that had no near grid (the west hills, an east strip) have a 10 m one pinned the same way as the rest (t8). Details, checks and the size cost: docs/faithfulness/terrain.md. The distance haze of the terrain (n9) is a shader term of the three terrain materials, not a vertex tint (docs/faithfulness/ground.md). `setPart` freezes the matrices of every object a tile part adds (`matrixAutoUpdate = false` after one `updateMatrix`, nothing under the world root moves). The steep-face fill of the far and tile terrain materials (`FAR_FILL`, `TERRAIN_FILL` in `src/world.js`) lightens the black wedges between Pellegrino's blocks.

### Parked cars and the bus (board items p9 and p8)

The untextured white block cars of `src/props.js` are gone. Parked cars are the traffic's own models (`assets/traffic/models.js`: panda, punto, smart, van; `buildParkedModels` is the same four with a lighter wheel hub, 364 triangles instead of 452), drawn with the traffic material
(instance colour tints the paint only), in the traffic's colour mix. Placement (props section 6b, per tile when it reaches full detail): runs of cars nose to tail along the kerb, with now and then a gap, on both sides of the residential streets,
avenues and secondary roads, thinner towards the outskirts and the rural zones; one side only where the carriageway is too narrow for two rows and a car passing (a gap of 2.7 m is always left). OSM parking tags (`pk`) win where
they exist (`n` none, `q` / `d` nose-in or diagonal). Never on a bridge or in a tunnel (`br`, `tn`), within 6 m of a junction (also keeps side streets and driveways clear), within 3.2 m of a crossing (marked or not),
within 12 m of a bus stop (OSM and the AMAT list), or within 2.7 m of a tram rail. The cars are instanced per model in 100 m cells, drawn to 110 m and cast shadows to 60 m. A garage door cannot be told from the plan, so only the junction rule protects driveways.

Hit below 4 m/s of closing speed a parked car is pushed (the overlap is shared by mass); at 4 m/s and more it is launched exactly like a traffic car (`launch` / `stepFly` of `src/traffic.js` copied into `src/props.js`: same speeds, spin, bounces, chain reaction onto the next parked
car, the driver's balloon that follows the car), then lies there and rights itself with a hop where it landed. It then stands parked again (and can be hit again). The cars the lapa moved are kept for the session by slot (tile and
original spot, `PARKED_MOVED`), so they are still there when the tile is built again; every random draw of 6b comes from a generator seeded by tile and road, taken the same whether a slot is filled or not, which is what keeps the slots stable.

Buses (`TYPES.bus` in `src/traffic.js`, mass 11): pushed like any vehicle but they barely budge (below about 14 m/s of closing speed a hit shares the overlap 11 to 1 and the lapa bounces off); above that (`yeetV`) the bus is knocked over: a short hop (0.3 of the car launch), it rocks onto its side instead of tumbling, lies 1.8 s and rights itself;
the lapa loses half the closing speed. The bus driver shouts and the police see it, as with any yeeted vehicle.

### Parked cars and traffic, and what the lapa does to props (board items p5 and the parked-car loose ends)

**Traffic and parked cars** (`parked` in `src/props.js`, used by `src/traffic.js`): a traffic or police car no longer drives through a parked one.
- Swerve: every vehicle looks, in the frame of the edge it is on, at the parked cars beside its lane within its reach (6 m + 1.4 x speed). It shifts sideways to clear them (0.35 m to spare, down to a scrape), never past the centre line of a two-way road, and goes back to its lane once past.
- Crawl: where the cars leave no room at all (a street the placement judged wide enough but the lane geometry does not fit, a landed wreck) it slows to 4.5 m/s and takes the best line.
- Bump: whatever it then touches is pushed aside, the overlap shared by mass (a car moves half). A launch needs a ram, 7 m/s and a mass at least the parked car's (a scooter never launches one), and it raises no police chaos. The police in a chase go through the same check.
- Streets: the placement now keeps two lanes open on a two-way street (4.6 m between the rows; a one-way street keeps 2.7 m), so a narrow two-way street has cars on one side only, or none.
- Measured (40 s at La Cala and in the Via Zisa quarter, `trafficpark.mjs`): traffic samples overlapping a parked car 13 % and 26 % before, 0.2 % and 0.7 % now.
- Chaos: launching a parked car (or chaining one) raises the same police chaos as launching a traffic car (`pd-yeet` event, kinds `yeet` and `chain`, same limits).
- The Ape and the Apetaxi props are parked-car yeets now (same launch, tumble, balloon and shout, they stand where they land). Their positions are placed from the tile's global random stream, so unlike the cars they are not remembered when the tile is built again.

**What the lapa does to props** (`SPECS` in `src/props.js`; the speeds are the closing speed along the contact normal, m/s). Light things are knocked flying with the same yeet, balloon and shout rule as the other flying props (one balloon per 1.2 s), lie where they land and are put back by the tile after 25 s when the lapa is more than 80 m away.
Heavy things are solid or bend; a bent post stays down until its tile is rebuilt.

| kind | what it is | below | at speed |
| --- | --- | --- | --- |
| bin_big, bin_over (cassonetti) | light | solid up to 2.2 to 2.6, then tips and spills bags | 6: the whole bin flies (bags too) |
| bin_small | light | bends at 3 | 5.5: flies |
| busstop sign | light | solid, bends at 4.5 | 8: torn out and flies |
| scooter | light | topples at 1.2 | 7.5: flies |
| bench | light | solid | 3.5: flies |
| cafe_set (table and plastic chairs), umbrella over it, stall_table | light | solid | 2.2 to 2.5: fly (the table and its parasol go together) |
| sunbed, beach_umbrella | light | solid | 1.5 / 2.5: fly |
| litter, bags, cardboard, rubbish piles | soft | burst into debris at 0.9 to 1.6 | |
| lamp_pole, candelabra, signal (traffic light, and its mast arm on the wide roads), fontanella | heavy, bend | solid | bend over at 6.5 to 7.5 (fontanella 5) |
| bollard | heavy, bend | solid | bends at 5.5 |
| trees and palms | heavy | solid | fall at 8 to 14 (by trunk size), in a shower of leaves |
| shrub | soft | none: the lapa goes through, slowed | 2.5: a puff of leaves |
| fountain, monument, kiosk, hydrant, phone, postbox, cabinet, hedge, bus shelter | heavy, solid | solid | never |
| planters | none exist in the world yet | | |

Cars parked along the kerb: see the section above (pushed below 4 m/s, launched from 4).

### Mondello beach strip (board item c5)

`tiles.py` `widen_beach` (called from `build_land`) pushes the coast seaward where the dry beach of Mondello is narrower than 58 m (26 m at most, 8,300 m2 in all, not at the Antico Stabilimento): the strip is land, sand layer (`streets.sand`, `areas` kind sand) and terrain. A full bake does it; the live world was patched in place for the tiles -7_-20, -6_-20, -6_-19 (near grids, the sand pieces) and the manifest's land ring, with the same strip.

### The harbour quays (board item n10)

OSM's coastline of the port is a polyline; the terrain fell from the town to the sea floor over a 5 to 10 m cell, so the quays were sand slopes (a probe at the Molo Santa Lucia read 2.4, 0.5, -1.5 m over 10 m) and the buildings on them stood on a slope into the water. `tools/quays.py` (called from `build()` in `tools/tiles.py`) now makes decks in the port zone (x 100 to 1300, z -3340 to -380, the beaches excluded) and `src/quays.js` turns them into ground, walls and props:

- **Tile record** `quays: { d: [[h, top, blend, ring, flags], ...], w: [[x0, z0, x1, z1, h], ...] }`. Decks are cut on the 50 m grid. `d`: the apron strip (land within 9 m of the coastline: flat at 1.6 m, fades into the town over 8 m, paved by the street layers: it is added to the pedestrian/paving geometry, roads on it stay roads), the band (2 m of sea beyond the coastline, drawn flat by `quays.js`, it hides the 5 m terrain cell that falls away behind the wall and is added to `areas` as `pier` so the sea treats it as land), and the piers (the OSM `man_made=pier` and `breakwater` lines, 5.6 m wide: 1.6 m high when 60 m or longer, 0.8 m for the marina pontoons). `flags`: one 0/1 per ring edge, 1 = a seaward edge (a wall). `w`: the wall pieces.
- **Gaps** in the walls: 6.5 m each side of the end of a road that meets the water (a slipway, 28 in the port) and of the free end of a long pier. There the deck simply ends and the ground falls to -2.4 m: the lapa goes off and the sea module drowns it (checked: drive off the Molo's pier end, "TUFFO!").
- **Ground** (`carve` in `src/quays.js`, called inside `hooks.ground` after the bridges' carve): the deck height inside a ring; outside, 0 to 8 m from a strip's land edge, a smooth fade to the terrain; within 6 m of a wall it is dredged to -2.4 m so the sea floor cannot show in front of the wall. A tile with quays gets 5 m terrain cells (`world.js` `terrainMesh`). Measured along the walls of three tiles (295 samples at 0.5 to 7 m from the edge): all within 0.1 m of 1.6 m, none under 0.3 m.
- **Walls**: a stone face from the deck to the sea floor (double sided), a 0.45 m coping, bollards every 20 m: one merged mesh per tile, a few hundred to 10,000 triangles. The wall pieces are collision (registered under their own key `q<tile>` so the tile's physics coming and going leaves them): along the whole straight quay the lapa stops at 1.5 m (drive test at 9 m/s on 8 walls of tile 1_-3).
- **The commercial port** (box x 500 to 1300, z -3300 to -1900, `FREIGHT`): container stacks (6.1 x 2.4 x 2.6 m, 1 to 3 high, in 8 colours, a row 5 m back from the edge, not on buildings or roads) and gantry cranes (a 15 m gauge, 38 m girder, a 52 m boom out over the water, one per 150 m of quay), both collision.
- **The floating dry dock** of the shipyard (`w1349488887`, `dock=floating`, 104 x 33 m in the water): `src/lmc-port.js`, a hull pontoon at the water line with two wing walls, two travelling cranes. It floats, as the real one does.

The live world was patched in place with the same bake (`quays_once.py`: the `quays` record, the band `pier` areas and the strip paving in the 19 tiles from x 0 to 2 and z -7 to -1); a full bake does it from `tiles.py`.
