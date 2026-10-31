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
