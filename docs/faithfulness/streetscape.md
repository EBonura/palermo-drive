# Streetscape (src/streets.js, src/gardens.js): status

Stopped early for budget. No code was changed: src/streets.js, src/gardens.js and src/world.js are untouched, no screenshots taken.

## Root causes found (from reading code and bake)

- White halos: `tools/tiles.py streets_for_tile` builds `raised` as "all ground within URBAN_REACH = 24 m of any building, minus asphalt, paving, green, water, sand".
  It knows nothing about sidewalks, so every sparse cluster outside the old town gets a 24 m slab ring. Only Mondello is patched (src/gardens.js
  swaps the slab texture for lawn with a world-space mask, 3 m off roads).
- Tan bands along ring road, Via Oreto, south coast: where no building is within 24 m there is no `raised`, `green` or `paving` at all, so the tinted terrain
  (plus the road-shaping bench) touches the asphalt directly. `curbs[]` only exist where asphalt touches raised/green.
- Motorways: `tools/streets.py width_of` turns `lanes` into 3 m per lane and `cw` is baked, but there is no median, shoulder, barrier or lamp geometry anywhere;
  roadMarksIter only paints lines. Dual carriageways are mapped as two oneway ways (`o`), the gap between them is bare terrain.
- Viale Regione Siciliana at 38.13036,13.33005: not investigated (check `br` bridge flag in roads[]; roadMarksIter and the asphalt both skip/handle `br`/`tn`).

## Plan that was designed (not built)

1. Per-tile mask canvas (about 1 m/px) in streets.js, built in streetsIter when `opts.tile = t.data` is passed (one-line hook at world.js `streetsIter(... layers: ['raised','green'] ...)`):
   stroke roads[] by class to mark a sidewalk zone (1.5 to 2.5 m past the carriageway edge), buildings dilated about 2 m, dense-core polygons (centro storico, Kalsa,
   Politeama/Liberta grid) kept as slab. Generalise gardenPatch: outside the mask the raised material shows lawn (villa districts) or a new dry-yard texture
   (ZEN, Zisa, Brancaccio, Villagrazia, Boccadifalco, Addaura). One material per tile, texture freed on geometry 'dispose' (world.js disposeObj frees geometry only).
2. Roadside strips from roads[] (cw/2 offset), skipping junctions with the same `clear()` grid roadMarksIter uses: kerb plus 1.5 m pavement in built-up streets,
   2 to 3 m dry-grass verge elsewhere.
3. Motorway/trunk: hard shoulder, median fill between paired oneway carriageways, W-beam rail and lamp posts as one merged or instanced mesh in the 'paint' or 'streetsHi' part.
4. Bake change wanted from the terrain agent (optional, better long term): emit a `sidewalk` polygon layer (asphalt buffered 1.5 to 2.5 m, minus buildings) and reduce
   `raised` to courtyards and plazas, or cut URBAN_REACH to about 4 m outside the dense core. That alone fixes finding 1 without runtime masks.

References (Street View, Commons) were not consulted yet beyond the survey notes.
