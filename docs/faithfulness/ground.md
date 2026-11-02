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
Far mountains (n9, reworked): the haze toward the style-guide blue `#7297b4` is no longer in the vertex colours. It is computed in the fragment shader of every terrain material (full-detail tiles, the low-detail ring, the far mesh: `HAZE_GLSL` in `src/world.js`) from the world height and the real distance from the camera: nothing within 300 m, building up to (0.1 + 0.3 x height factor) by 2.5 km and, for high ground, up to 78 percent by 8.5 km. A hill that is half in a full-detail tile and half in a low-detail one has no blue/tan seam any more and nothing reads as a blue overlay up close; the previous per-tile tint (42 percent above 100 m on the whole ring, whatever the distance) is gone. The fog does the rest.


## Terrain tiling and tile-border lines (hills, 2026-11-02)

- The terrain detail texture repeats every 48 m, which read as a regular grid on a hillside seen from a few hundred metres. `terrainMaterial` (`src/world.js`) now multiplies a second sample of the same texture (rotated 33 degrees, 3.2 times larger, so the two periods never meet) and two octaves of value noise (260 m and 90 m, brightness only), computed from the world position in the fragment shader. Mean brightness of the ground is within 1 to 5 percent of before.
- The straight dark lines along tile borders were the 30 m skirts: the terrain is double-sided and three.js flips the normal of a back face, so a skirt seen from behind was lit as a face pointing down. The terrain and far shaders now light every face with its own vertex normal (`NORMAL_NOFLIP`), no dark line. The few small steps that remain where a low-detail tile meets a full-detail one (up to a few metres on a hillside) are the skirts showing a real height difference between the two meshes; the meshes cannot agree exactly at that border.

## Sky and haze from high cameras (board item x2)

The physical sky read pale grey-white (zenith 199, 207, 216 in the rendered picture, 210, 217, 219 at the horizon) and the ground-level fog (0.00014 per metre) piles up over kilometres, so the title flyover (90 to 130 m up) and every aerial view looked washed out. `src/daynight.js`:
- the day sky blends towards the style-guide gradient (horizon `#8ac8f7`, zenith `#3a7ebf`; the uniforms hold the values calibrated against the rendered pixels, `DAY_SKY_H` / `DAY_SKY_Z`) with a weight `uDayG` of 0.4 at street level up to 0.92 at 120 m and more above, and less in the halo round the sun so the physical sun glow stays; twilight, dawn, dusk and night are untouched (they use their own gradient and the blend is only in the day branch);
- the fog density is divided by 1 + (height above ground - 30 m) / 260, so nothing changes below 30 m (the driving cameras sit at 3 to 15 m), 0.8 at the flyover's 100 m, 0.3 at 650 m.
Rendered at 9:00, 12:00 and 17:30 the sky reads (76, 142, 197) at the top of the frame and (119, 175, 210) at the horizon from 650 m, the city is crisp to the horizon; a street-level view differs by 3 to 6 grey levels on average.
