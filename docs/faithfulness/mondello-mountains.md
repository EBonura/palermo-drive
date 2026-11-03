# Mountains from Mondello and the seafront

Monte Pellegrino and Monte Gallo were a smooth pale ramp. Both the shape and the surface were wrong.

## Shape

The tiles carry the 10 m TINITALY heights and the streamed terrain (10 m full, 20 m low, out to 1.4 km) is fine. Beyond that the mountain is the manifest's 100 m far grid, which turns a 150 m wall into a ramp one or two cells wide (hillshade of the DEM against the grid: `/private/tmp/claude-501/mountains/hill_cmp.png`). The grid is also wrong in places: on the north face of Monte Gallo (z about -11600) nodes are 50 to 260 m below the DEM, because the DEM box average there is empty next to the sea and the grid fell back to Terrarium.

Fix, at runtime and without touching tiles or the manifest: `tools/hills_far.py` writes the DEM at 25 m for every 500 m tile with relief above 40 m (936 tiles, `assets/world/hills.bin`, 829 KB, 288 KB gzip), `src/hills.js` builds 2 km chunks from it (25 m cells within 4.5 km of the camera, 50 m beyond, out to the fog radius plus 1.5 km), and `world.js` leaves out the coarse far cells under a fine chunk and the fine cells of a tile that has streamed in as terrain. Ground height for physics is still the coarse grid and the tiles. Skirts of 60 m hide the cracks against neighbours. The file is fetched after the manifest and counted in `visiblePending`.

## Surface

`ROCK_GLSL` in `src/world.js`, in the terrain and far shaders: above 40 m, slopes from about 8 to 20 degrees fade to dark scrub, slopes steeper than about 37 degrees to grey-ochre limestone with ledges (bands in height, bent by noise), scree and ochre patches; the normal is mixed with the face normal and tilted by the ledge band so the facets and strata light as crags. Less blue haze on rock and scrub, `FAR_FILL` 1.1 to 0.5 so a face turned away from the sun is darker than one turned to it. Noise comes from one 64 x 64 texture (one channel per scale), which cost less than the first version with hashes. Near the camera the rock is multiplied by the detail texture so flecks and streaks stay. Below 40 m and on slopes under 8 degrees nothing changes (beach, streets, city ground).

Cache keys now end in `-rk`.

## Not done

- The real cliffs are steeper and taller than a 25 m mesh of a faceted 10 m DEM gives; from the beach the game mountain is still smaller in the frame than in the photos (the photos are wide angle and the positions are phone GPS).
- No vertical streaks, no scrub terraces, no trees on the slopes beyond what the tiles already place.
- Hairpin slab at pe08 (Via Pietro Bonanno) is the tile terrain wedge from round 2, not touched.
- The night mountains are still moonlit pale (the emissive fill), unchanged in kind.
