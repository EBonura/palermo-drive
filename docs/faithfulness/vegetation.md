# Vegetation: status (stopped early, budget)

Nothing in src/ was edited. No species models, no placement changes, no ground-colour change, no before/after screenshots were made. Every file loads as before.

## Findings so far (for whoever continues)

- Tile data (`world/tiles/*.json`) carries `props.items` of kind `tree` with OSM `sp`, `ge`, `lt`, `lc` (about 3000 trees in total, mostly needleleaved/broadleaved/palm, some Ficus macrophylla, Olea, Platanus, Cupressus, Phoenix, Washingtonia, Araucaria, Dracaena).
- Tile `areas[]` carry only `k` (forest, green, scrub, orchard, rock, ...) and polygon `p`. No names, no `leaf_type`, no `trees`/`produce`. The tags exist in the OSM cache `data/city/pbf_misc_000.json.gz` (woods with leaf_type needleleaved/mixed, orchards with olive_trees/lemon_trees/produce olive/orange, 69 named parks incl. Parco della Favorita, Villa Giulia, Villa Trabia, Giardino Garibaldi, Villa Garibaldi, Orto Botanico, Villa Malfitano, Parco d'Orleans).
- Current trees: `src/world.js` `getTreeGeo`/`buildTrees` (one spruce cone, 22 tris, one InstancedMesh per tile, spacing 11 m, cap 2400 per tile / 900 mobile, forest p 0.9, green p 0.3 or 0.55 for parks over 160 m). `src/props.js` models `ficus, orange, tree, pine, shrub, hedge, palm_fan_a/b/c, palm_date_a/b` (lumpy icospheres, `MB` builder), pickers at `treeKind`, section 9 (parks), tree rows, avenue/seafront (planes on Liberta, palms on fronts), Mondello villa gardens (`GK` table). Per-model tables to extend when adding a model: `MODELS`/`def`, the collision table (~line 542, kind tree, thr/H/crown), `SCALE_R` (~591), `FAR` (~1911).
- `src/gardens.js` only recolours the raised pavement in Mondello; park lawn colour lives in `src/world.js` `C.green` (#72844b) / `COVER.green` and the `green` layer texture in `src/streets.js` (both edited by other agents).

## Plan (not started)

1. `src/trees.js`: own vertex-colour builder, low LOD (30 to 100 tris) species: stone pine (umbrella), Aleppo pine (irregular), Canary palm, ficus (dome, aerial roots), plane, holm oak, eucalyptus, olive, carob, citrus, oleander, prickly pear, cypress, macchia clump. Export `speciesModels()` and `pickSpecies(ctx)`.
2. Context data: small `tools/vegetation.py` reading `pbf_misc_000.json.gz` into a committed `src/veg-data.js` (tagged woods, orchards, named parks as polygons), looked up by point-in-polygon; plus a hand table of regions in local metres (Favorita, Pellegrino, Conca d'Oro/Ciaculli/Villagrazia, Foro Italico, Mondello, Via Liberta, Piazza Marina/Garibaldi).
3. Call sites: register models in props.js (`def`-style, plus collision/FAR/SCALE_R entries), swap `treeKind`, section 9, tree rows, avenue/front and Mondello `GK`; in world.js `buildTrees` make one InstancedMesh per species per tile.
4. Ground: dry ochre/straw for `green` outside irrigated gardens (Villa Giulia, Giardino Inglese, Villa Trabia stay green); needs coordination with the world.js/streets.js owners.
5. Shots at Viale Diana (-1407,-4397), Pellegrino (pe04 -96,-4451), Foro Italico (945,-382), Via Liberta, Giardino Inglese, Piazza Marina, Mondello (-3076,-9460), Ciaculli; check triangle counts with `tools/build/measure.mjs`.
