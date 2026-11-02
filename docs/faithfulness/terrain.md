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

## Status (end of session)

Done and live in `world/` (the `--terrain-only` bake finished cleanly: 742 of 1119 tiles patched, all tiles and the manifest parse):
- DTM cleaning, the baked road bench (5 m cells, `near.bench`, smoothed along the road; checked against MASE points: Via Pietro Bonanno hairpin within 1 to 3 m of the lidar), motorways benched,
  far grid corrected with lidar (Piazza Mondello 6 m to 2.4 m, Quattro Canti 30 m to 13 m, Acquasanta 22 m to 13 m; point samples instead of 100 m averages so cliffs keep their steepness),
  low detail vertices dropped below a bench, 30 m tile skirts (cracks along tile borders on cliffs showed the sky as blue slivers), triplanar terrain texture.
- The load-order race in the survey (Bonanno hairpin buried 7 to 9 m when loaded cold) came from `computeShape` reading neighbour tiles that were not in yet. The bench is now a function of position in the bake,
  so it cannot depend on load order. Not yet re-verified with a cold `?at=` load after the final bake (I had just started it).
- Piazza Mondello: the near grid was already 1 to 2 m (lidar agrees to 0.7 m rms); the 6 to 13 m came from the far grid, now fixed.
- Monte Gallo: the near grid already holds the lidar wall (549 m to 268 m over 120 m on the NE face); the "smooth ramp" seen from Mondello was the 100 m far grid, now point sampled.

Second session (2026-11-01): the lattice fetch finished (27179 of 27179 lattice points answered, 7792 of them null, which means no lidar there; no failures were left over, the last run did 13679 points at 3 to 6 per second with 16 threads). The `--terrain-only` bake then patched 51 of 1119 tiles (the other 1068 came out byte-identical and were not rewritten; it took 104 s) and the manifest far grid. All 1119 tile files and the manifest parse. The Pellegrino 55 to 204 m band now comes from the point lattice instead of the cleaned raster.

Numbers, city-wide check (`tools/terrain_check.py`, 1119 tiles, 2355 km of drivable road sampled every 3 m), first version to now: meshlow 16.0 % to 0.45 % (10569 m), bank 5.1 % to 0.19 % (4527 m), grade 2.1 % to 2.15 % (50541 m), bump 1.6 % to 0.06 % (1356 m), cross 4.3 % to 1.82 % (42822 m), mesh 1.45 % to 0.46 % (10743 m).

Grade did not move: it is mostly steep real streets plus long unclassified, service and track ways in the outer hills (the biggest clusters are 400 to 640 m of track or service road with a worst of 0.4 to 0.6, i.e. barely over the threshold), so it is not a terrain fault. The full report is `data/terrain_check_2026-11-01.json`.

Worst remaining clusters by named street, all outside the centre: the Autostrada Palermo-Mazara del Vallo in tiles -18_-19 and -19_-19 (bank 291 m and 174 m, meshlow 201 m up to 3.18, mesh 210 m up to 1.92), Via Monte Ercta in -5_-17 (mesh 99 m, up to 6.49, and cross 129 m), via Pier Paolo Pasolini in -20_5 (bank 138 m, meshlow 117 m, mesh 90 m), Corso dei Mille in -12_15 (mesh 102 m, meshlow 90 m), Via Pergola and Via Veronica in -11_15 (bank 102 m and 72 m), Via Fontana del Drago in -11_5 and -12_6 (mesh 90 m, cross 258 m), Via L17 in 15_11 and 16_11 (meshlow 108 m and 96 m). Unnamed tracks and service roads in the far west (x below -8000) carry most of the remaining meshlow and bank metres (the worst is a track in -18_-16 with meshlow 261 m up to 5.08, and a track in -18_-15 with bank 93 m up to 9.00). In the inner city (x within 4000, z from -5000 to 4000) nothing is above 219 m per cluster; Via Pietro Bonanno shows a grade cluster of 99 m (0_-8, worst 0.45).

Ground truth (`tools/terrain_truth.py --worlds world`, 660 road points, 239 with lidar): bias +0.1 m, rms 1.1 m, p95 2.3 m, max 8.2 m overall. Acquasanta rms 0.8, Centro 0.7, Capo Gallo 0.7, Pellegrino plateau 1.1, Pellegrino S/E roads 1.1, Ciaculli 0.4, Arenella/Vergine Maria rms 1.7 with the 8.2 m maximum. Favorita, Monreale/Baida, Boccadifalco and Bellolampo had no lidar points.

Bench coverage: not every tile has `near.bench`. 1119 tiles: 683 have a benched near grid, 80 have a near grid without a bench (the bake returns no bench when a tile has no benchable road or the bench would move the ground by less than 0.3 m), 356 have no near grid. Of the 80 unbenched, only 2 hold benchable roads on ground above 150 m (13_15 and 12_15, both flat service roads at 233 to 247 m), and the bake judged them not to need one. So the transitional rule in `computeShape` can go; see Left.

Done after the rebake: `computeShape` now returns early for every tile with a near grid (`if (t.nearS || hi - lo < 12) return;`), so tiles without a near grid keep the old `hi - lo < 12` test. Cold-load check with that rule (fresh profile, cache off, `?at=...&play&debug`): the car lands on the asphalt at both points with the terrain mesh about 0.2 m below it. Ground at the car is 109.64 m at 309.5,-4001.9 and 156.67 m at 262.5,-3976. The first point was 107.6 in the previous bake; the new lidar lattice reads 109.0 there (bilinear on the 20 m lattice), so the rebake moved it toward the survey. The second point has no lattice value; it matches the previous bake to 3 cm.

Left:
1. The blue strips were not positively identified; the likely cause (sky through cracks at tile borders, skirt was 8 m) is fixed. The pale "paving" pads around Pellegrino houses and the spruce trees are streets.js / props (streetscape agent), not terrain.
2. The dark gash on one Pellegrino face seen in a distant view was not located. (Looked at again in t6 below.)


## Outside the lidar belt: TINITALY plus the survey's foot elevations (board item t8, 2026-11-01)

Finding (again): away from the lidar rasters the ground was Terrarium (SRTM at 38 m, which reads roofs and treetops), 5.7 m too high against the Comune's building foot elevations
(`g` of the CTR heights, 72 k points that agree with the lidar to 1.4 m rms), 15 to 22 m too high at the Ponte Corleone valley. Fix in `tools/tiles.py` (`far_grid`, `near_for`):

- **Base:** TINITALY (10 m, `tools/dem.py`) everywhere it has data (it was blended in only above 80 to 140 m); Terrarium only beyond it. Every tile with TIN data now has a near grid (899 tiles, was 763).
- **Pinned to what is known:** the lidar where present, as before (its residual to the TIN smoothed over 40 m, faded over 200 m); beyond it the 49,047 survey foot elevations of buildings that have no lidar
  roof (`CTR_*` constants): residual smoothed over 45 m, trusted in proportion to how many points fed it, faded out 220 m from the last one. One residual field, so lidar and survey agree across the seam.
- **Shore:** land within 80 m of the sea and outside the lidar keeps at least 1.0 m, so the shoreline does not move (the cells between -1.4 and 0.4 m: 6,270 before, 6,296 after).
- **Check, hold-out** (`T8_HOLDOUT=1` leaves out every tenth survey point): on 4,879 points the pipeline never saw, ground minus survey foot: bias +5.72 m, rms 6.93, 55 % off by more than 5 m before; bias +1.09 m,
  rms 2.89, p90 4.4 m, 7.7 % off by more than 5 m after. In the lidar belt, Mondello, Monte Pellegrino and the hills the ground did not change (Quattro Canti 13.2, Piazza Mondello 2.4, Santuario 156.6, Via Oreto 22.6).
- Road check (`tools/terrain_check.py`, 2,355 km): mesh 10.7 to 9.8 km flagged, cross 42.8 to 41.8, bank 4.5 to 4.4, meshlow 10.6 to 10.5, bump 1.36 to 1.34, grade 50.6 to 51.2.
- Known: TIN itself reads 2 m above the survey on average and has local errors of 5 to 10 m in steep or built-up pockets; at Baby Luna the survey says 72 m, TIN and the result 61.6 (the bridge deck follows the ground, so it sits
  consistently with its roads). The seam at the lidar belt edge is a 200 m fade, visible only as a gentle slope change.
- **Rivers under bridges after t8:** the ground now holds the TIN valley, so the old bed (deck minus `dep`, computed when the tile loaded) was above the valley floor over most of the 200 m window and the water was skipped as hanging. The bake now cuts every river line into pieces of about 8 m and stores `rf` (lowest ground across the valley floor at each vertex, in the tile's own frame; `structures.river_floor`, written by `add_heights`, which `--terrain-only` now re-runs too). `src/bridges.js` digs the bed `RIVER_DIG` (0.9 m) under that floor, never above the old deck-based bed, and the water sits 0.4 m above the bed. The floor cannot be measured at load: the river runs over tiles that have not streamed in yet.


## Hills outside the first TINITALY window (board item t7, 2026-11-02)

`tools/dem.py` had fetched TINITALY for the UTM window E 874000..890000, N 4220000..4242000, which stops short of the play area: the west (Bellolampo side, the ridges above Monreale and Montelepre, x < -8,700 m) and a strip in the east (x > 7,000 m) had no TIN, so 222 of the 1,121 tiles had **no near grid at all** (ground from the 100 m far grid, 50 m low-detail cells, no road bench). The window is now E 869400..892200, N 4218200..4242200 (every world tile plus 600 m, 26.2 MB; the overlap with the old file is byte-identical, `data/dem_tinitaly/tin_raw.tif`, old one kept as `tin_raw_t8.tif`).

- `tiles.py --terrain-only` (nothing else changed): 222 tiles gained a 10 m near grid (213 of them with TIN over more than half of the tile; the other nine are the edge tiles with a sliver), 100 tiles at the old window edge got different near grids (up to 65 m at the west edge, where Terrarium used to be blended in, rms 7 to 21 m), the far grid changed in 12,532 cells (rms 4.2 m, max 130 m), and the bridge end heights followed (114 tiles' `structs`). Three tiles on the east edge (`14_5`, `14_7`, `11_15`) went from a benched 5 m grid to an unbenched 10 m one: the bake judges the bench moves the ground by less than 0.3 m now that the TIN there is complete.
- Same pinning as t8, nothing retuned: lidar where there is any, the survey foot elevations beyond it, shore floor. Hold-out (`T8_HOLDOUT=1`, which `--terrain-only` now honours): 4,879 held-out survey points, bias +1.09 m, rms 2.89 m, p90 4.4 m, 7.7 % over 5 m, identical to t8 (only 3 of those points lie in the new tiles, so the new hill tiles have no independent ground truth beyond the lidar lattice).
- Seams between neighbouring tiles (ground of both sides along the shared border, every 5 m, 2,155 borders): borders over 1 m 69 to 42, over 3 m 18 to 11, worst 15.4 to 12.0 m. Every tile now has a near grid, so no border joins a near grid to the far grid any more (57 such borders before, up to 3.4 m).
- `tools/terrain_check.py` (2,355 km): mesh 9.8 to 6.5 km flagged, meshlow 10.5 km to 12 m, bank 4.4 km to 0, bump 1.3 to 1.0, grade 51.2 to 48.8, cross 41.8 to 46.4 km (real hill roads show their true cross-fall at 10 m).
- Size: near grids add 14.0 MB of raw JSON (125.4 to 136.9 MB for the world, 32.3 to 35.1 MB gzipped) and, packed (`data=bin`), 16.0 to 17.0 MB on the wire (+1.0 MB, 6 %). Spot bench (desktop and phone, Pellegrino, the east edge, three west hill spots, the centro): triangles and draw calls within a few percent, frame times unchanged.

### The dark gash on Pellegrino (t6)

Looked for from eight directions at 2.3 km, from the sea, from the city and from above. What reads as a black slash on the mountain is the **shade on steep faces that look away from the sun**: the north-facing facets between the bright blocks, mostly of the 100 m far mesh (`far_-1_-2`, the east and north crest at x -900 to 0, z -7350 to -5400, ridge heights 200 to 460 m) and of the low-detail tile meshes `terrain_0_-12` and `terrain_0_-11`. The sun is 2.9 and the hemisphere fill 0.4, a face turned away gets the fill only, so the far mesh (smooth normals, no texture) is a flat 40 % grey wedge next to a face lit at 100 %. `src/world.js` now adds a fill that grows with steepness (about 1.1 of the surface colour on a vertical far-mesh face, 0.4 on the textured tile terrain, nothing on level ground: `FAR_FILL`, `TERRAIN_FILL`), so the wedges come out at 60 to 70 % of a lit face and the cliffs keep their modelling.
Not touched, found on the way: one column of near-grid nodes at x = -30, z -5730..-5640 (tile `-1_-12`) mixes lidar lattice and raster values (321, 319, 316 beside 165, 162, 148 m over a 185 m foot), a one-cell fin at the foot of the east wall. The raster is right below 204 m (it matches the lattice to 0.8 m at x = 100), the TIN is 40 to 100 m too high there, so dropping the raster or clipping the lidar-minus-TIN residual (both tried) made things worse (a 130 m bulge in the wall). It stays.
