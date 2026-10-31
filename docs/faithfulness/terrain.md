# Terrain under the roads: findings and fixes

Owner: terrain agent. Files: `tools/tiles.py` (near grid, DTM cleaning, road bench, `--terrain-only`), `tools/lidar_hills.py`, `tools/lidar_truth.py`,
`tools/terrain_check.py`, `tools/terrain_truth.py`, `src/world.js` (terrain mesh, material). Screenshots: /private/tmp/claude-501/terrain/ (before `b-*`, after `a-*`).

Complaint: "terrain goes over the road, slopes that are not there (Acquasanta, between Via Ammiraglio Rizzo and Via Ruggero Marturano), Monte
Pellegrino is a mess, roads hidden by the terrain near the mountains". Heights are globally right (Quattro Canti 13 m, Utveggio 318 m, Santuario 451 m),
so nothing was scaled; the causes were local.

## Root causes

1. **The MASE lidar DTM is a rough ground model in town.** The decoded 2 m raster agrees with GetFeatureInfo point queries to 0.5 m rms (checked on a 20 m
   lattice over Acquasanta), so the decoder is fine, the source is not: plateaus with 1 to 4 m steps (14.9 m, then 12.9, then 11.8 across 30 m),
   pits at building footprints and dark halos around them (no ground returns under roofs), the odd 3 to 7 m pit. Sampled raw at 10 m that is the
   "5 to 10 m bump or dip every 25 m" of Acquasanta, and every street drapes on it. Fix: `clean_dtm` in `tools/tiles.py` (see below).
2. **`tools/lidar_hills.py` and `lidar_raster.gfi` read the wrong band.** The DTM layer's GetFeatureInfo answers `@3` = DTM and `@6` = DSM (roofs,
   canopy). The code took the last band, so every hill height above 204 m (the Pellegrino plateau, Capo Gallo, Billiemi) was the surface of the
   pine woods and buildings, up to 40 m above the ground (4.5 % of points differ by more than 3 m from the DTM). `tools/lidar_truth.py` reads bands
   by id; `lidar_hills` now stores `points_dtm.json`.
3. **The decoded raster is quantised between 60 and 204 m** (the 8-bit ramp has 3 to 4 m of resolution up there): terraces on the cliffs and dimples on the
   foothills of Monte Pellegrino. The point lattice now starts at 55 m (`LATTICE_LO`) and replaces the raster wherever it has answers.
4. **The road bench was per tile and loader dependent.** `computeShape` in `src/world.js` carved the bench from the roads clipped to the tile and read the
   ground of whichever neighbours were loaded. A hill tile next to a lowland tile (which skipped shaping below 150 m) had a 2 m step along the border
   (Via Pietro Bonanno at x = 500), and neighbouring benches disagreed. Now the bench is baked into the near grid as a function of position
   (`_bench` in `tools/tiles.py`, whole OSM ways, 5 m cells, `near.bench = 1`), so streets, trees, buildings, the car and the terrain mesh all see the same surface.
   Motorways and trunk roads (the A29 cuts into slopes) were not benched at all; they are now.
5. **Low detail terrain (more than 650 m away) is 20 m cells** (50 m without a near grid) and could not follow a bench: Via Pietro Bonanno was up to 19 m
   under the coarse mesh for hundreds of metres, i.e. a hidden road. Benched tiles now use 5 m cells at full detail and 10 m at low detail, and each low
   detail vertex drops to the lowest ground within 5 m, so the mesh never rises above a road beside it.
6. **World-space (x, z) texture UVs smear on cliffs.** The terrain detail texture is now triplanar on steep faces (`terrainMaterial` in `src/world.js`).

## The check (`tools/terrain_check.py`)

Python, over the baked tiles, no browser. It re-implements the runtime (`groundY` from the near/far grids, the terrain mesh triangles, the low detail
vertices) and walks every drivable road every 3 m, flagging: `mesh` (full detail mesh above the road surface by more than 0.2 m across the carriageway
and kerb), `meshlow` (low detail mesh by more than 0.6 m), `bank` (ground rising more than 0.8 m within 4 m of the road edge beyond what the natural
hillside does), `grade` (more than 22 % over 6 m), `bump` (more than 0.5 m from a +-12 m running median), `cross` (cross fall above 12 %). It clusters
flags by street and tile. `tools/terrain_truth.py` compares the game's ground with fresh MASE DTM point queries along roads in a dozen regions.

```
tools/.venv/bin/python -I tools/terrain_check.py [--world world] [--tiles i_j,..] [--box x0,z0,x1,z1] [--out report.json]
tools/.venv/bin/python -I tools/terrain_truth.py --worlds world,data/world_try
```

## Rebaking only the ground

`tools/.venv/bin/python -I tools/tiles.py --terrain-only` recomputes every live tile's `near` grid (and the manifest's far grid) and patches them into
`world/tiles/*.json` one file at a time through a temp name and `os.replace`; nothing else in a tile changes (building footprints for the cleaning come from the
tiles themselves). `--out DIR` patches a copy instead (try it with `?worldurl=/data/world_try/`).

RESULTS_PLACEHOLDER
