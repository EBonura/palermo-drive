# Ground and land cover outside the centro: faithfulness notes

Owner: ground agent. Files: `src/world.js` (terrain colour/detail, trees, paint stage), `src/streets.js` (ground textures, `roadMarksIter`),
`tools/tiles.py` (land cover, road fields, bbox). References were looked at only (Google Maps satellite/Street View, never copied);
every texture in the game is procedural (no credits needed). Screenshots live in /private/tmp/claude-501/ground (before `b-*.png`, after `a-*.png`).

## What was compared and what was off

| Place | Real | Game before | Fixed |
| --- | --- | --- | --- |
| Monte Pellegrino (satellite) | dark olive Aleppo-pine woods, tan-olive grass clearings with scrub dots, pale grey limestone faces | lime-green slopes, plain beige cliffs, no texture anywhere | palette (dark olive scrub, grey-ochre rock), world-space detail texture with scrub clumps and limestone flecks, steep ground goes to rock even under OSM woods, forests dark |
| Outskirts, Oreto, ZEN (satellite) | dry straw/olive ground, fallow lots, rail yards, farmland | one flat beige | OSM `scrub, grassland, farmland, orchard, cemetery, railway, brownfield, bare_rock/scree, pitch` now tint the terrain |
| Mondello beach (Street View) | pale warm grey-beige sand, wide | thin yellow strip | sand colour and a rippled sand texture, `leisure=beach_resort` (lidos) count as sand, rocky shores (no beach polygon) are grey instead of sand |
| Roads outside the centro (Street View, Via Liberta) | asphalt with white dashed lane lines, zebra crossings | bare grey ribbons, no markings anywhere | `roadMarksIter`: dashed lane dividers (lanes and carriageway width from OSM), solid centre + dashed lanes on 4+ lane two-way roads, edge lines on trunk/primary, zebras at OSM crossing nodes, junctions left clear, worn dashes. Skipped inside the centro AOI (src/roadwear.js paints those) |
| Favorita, parks | dark pines and oaks, dry olive grass | lime lawn, pale sparse pines | olive grass texture and colour, dark pines, big parks (> 160 m) are mostly trees |
| Sferracavallo, Barcarello, south coast | part of the municipality | outside the baked area | bbox extended (see below) |

## Data changes (tools/tiles.py)

- Land cover tables `NATURAL_COVER`, `LANDUSE_COVER`, `LEISURE_COVER` -> `areas[].k`: new kinds `scrub, grass, rock, farm, orchard, cemetery, rail, dirt, pitch`
  (terrain tint only, no street layer, no name so no landmark side effects). `landuse=meadow` is now `grass` (dry), not `green` (lawn).
- Roads now carry the centro's traffic fields: `o` one-way (1 / -1), `l` lanes, `ms` maxspeed, `j` junction, plus `cw` (real carriageway width when OSM has it).
- bbox is now s 38.045, w 13.235, n 38.230, e 13.455 (was 38.065 / 13.285 / 38.225 / 13.420). Palermo's municipal boundary (OSM relation 39513, admin_level 8)
  spans 38.0499..38.2246 N, 13.2422..13.4521 E, so the whole comune is inside with margin. The bbox of a boundary is not the boundary: the corners of the box that
  are sea or other comuni are baked too (land only, tiles with no land are skipped). 1119 tiles, 99.7 MB raw, 27 MB gzip.
- The PBF cache was re-extracted for the new bbox (`pbf_extract`, written through a temp dir and renamed into `data/city`).

## Not done / notes for others

- Medians: Via Liberta and the Regione Siciliana carriageways are separate one-way roads with a raised strip between them; planted medians (oleanders) are not modelled.
- Hills outside the old bbox use the Terrarium far grid only (no lidar, no TINITALY), so their relief is coarser than Pellegrino's.
- Mondello lido huts, beach umbrellas, palms on the Foro Italico are props/landmarks (other agents).

## Dry ground and hazed mountains (board items n5 and n9)

Ground colour outside the irrigated greens (`src/world.js` palette and `terrainColor`, `src/streets.js` verge and terrain detail textures): the open lowland is ochre, straw and khaki (plain `#b3a685`, grove `#a39a68`, dry `#b5a26a`, hill scrub `#8d8458`, farm `#b19b5d`; the scrub clumps of the detail texture and the road verge are dry khaki too). Green stays where the data says it is irrigated: the street `green` layer (OSM leisure=park/garden, landuse=grass and every Comune green class), the OSM `green`, `forest` and `orchard` covers, the Mondello villa gardens. Checked on the Foro Italico park, the Giardino Inglese and the Favorita; the open ground at the ZEN, Uditore and the Cappuccini plain went from olive to ochre.
Far mountains (n9): the far grid is tinted towards the style-guide haze blue `#7297b4` by height and by distance from the city (10 percent at the foot up to 78 percent on the high ridges beyond 8 km), and the low-detail tile ring (beyond 450 m) blues the ground above 100 m by up to 42 percent. The fog does the rest. Full-detail tiles are untouched.
