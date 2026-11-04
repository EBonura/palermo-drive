# The towns around Palermo: a recipe

Villabate was the first. Monreale, Isola delle Femmine and Bellolampo take the same steps. What is general is in code that already exists and is reused as is; what is Villabate only is a handful of data lines and one landmark file.

## What Villabate looked like (Mapillary, March to April 2021, 54 photos at 37 viewpoints and the churches, looked at only, nothing copied)

- A grid of narrow streets (wall to wall 4.5 to 7 m on the side streets, measured on the baked footprints, so the 6 m class width is right) along a long corso (Corso Vittorio Emanuele, 10 m carriageway, parked cars both sides, wall to wall 13 to 21 m).
- 2 to 5 storey houses and 4 to 6 storey post-war blocks side by side, flat roofs, deep balconies with iron or glass rails, a stone or brick plinth under pastel plaster: ochre, salmon, peach, putty, white, now and then pale green or blue, a brick red.
- Ground floors: the roller shutter is the commonest front, then a plain door, a shop, a bar, a pharmacy (green cross), a fruit and vegetable stall with a striped awning on the pavement.
- Cars nose to tail on both kerbs, stone pines in the squares, the mountain close behind, a green noise barrier along the road at the east edge.
- The Chiesa Madre (Sant'Agata) stands inside a block between two lanes; no street photo shows its front. The Chiesa di San Giuseppe is modern: a low hall and a slender tapering concrete bell tower behind iron railings, palms and globe lamps.

## The recipe

1. **Look first.** `tools/mapillary_extra.py` style: ask the Mapillary Graph API for the images in the town's box, pick 40 viewpoints (centre, corso, side streets, church, edge, station), shoot the game at the same position and heading with `tools/faith_shoot.mjs` (a `meta/<id>.json` per viewpoint), read the sheets from `tools/faith_sheet.py`. The token is read from `data/mapillary_token` by your own script and sent as a header only.
2. **The zone** (src/districts.js, general). Copy the `villabate` entry of `ZONES`: palette (`plaster`), `fl` and `fh` (storeys), `w` (style mix: `n19`, `res`, `pal`, `blk`, `pw`), `elig: true`, `town: true`, `front` (how far behind a lane a facade still counts as a street front; 7 in a town of narrow lanes). `town: true` is what switches on the old-town facade machinery (buildings.js `old`: aged render, stone surrounds, tall shuttered windows, balconies in runs, passages) while keeping the zone's own palette and ground floors. Add 4 to 6 seeds to `SEEDS_LL` (`[zone, lat, lon, reach]`, one per part of the town; a building takes the nearest seed in units of reach) and a line to `TOWNS_LL` (the name the HUD shows).
3. **Street names.** `zoneAt` sends Via Roma and every Corso Vittorio Emanuele, Via Verdi and so on to the centro's zones. Inside a town zone's seeds they now stay the town's: nothing to do, but a town without its own zone yet keeps the old behaviour.
4. **Ground floors** (buildings.js `TOWN_GROUND`, general): four lists (market, main, side, minor street kind), roller shutters first. Edit the weights if the town differs (a town with a market street names it in `MARKET_FRONT`).
5. **Names in the HUD** (`townAt` in districts.js, used by src/danger-hud.js): the ISTAT neighbourhood grid has nothing outside Palermo, so the HUD said Palermo. One line in `TOWNS_LL`.
6. **Landmarks** (src/lmc-towns.js, one file for all the towns; register in src/landmarks-city.js through `TOWN_LANDMARKS`). Take the OSM footprint id and outline from the tile, use `src/lmc-kit.js` (`prism`, `panel`, `gable`, `paintFacade`, `frame`), `skipIds` hides the generic building, `radius` is the build range. Never draw what no photo or source shows as fact: say so in the file header.
7. **Heights.** Named buildings without lidar or levels carry a generic 18 to 22 m (a villino, an old station, a bandstand); in a `town` zone `applyDistrictHeights` now treats a name alone as no reason to keep that height (churches, `t`, `k`, `am` still are).
8. **Props** (src/props.js): add the zone to `ZONE_DIST` (how built-up, for car density), `ZONE_CARS`, `ZONE_SQ`, `CAFE_OUT` (share of cafes with chairs outside). Block 12f puts a produce stall on the pavement in front of every mapped greengrocer in a `town` zone.
9. **Check.** Before, after, photo at each viewpoint; the HUD name; Palermo centre, Via Liberta, Mondello and Brancaccio identical (pixel diff); frame time, draw calls and triangles before and after on the phone profile; route-check for legs nearby; no console errors.

## General and Villabate only

| Piece | General (reuse as is) | Villabate only |
| --- | --- | --- |
| `ZONES.villabate` fields | the field set, `town: true`, `front`, the ground-floor tables | the palette, the storey mix, the style weights |
| `SEEDS_LL`, `TOWNS_LL` | the mechanism | six seeds, one town entry |
| buildings.js | `old` machinery for `Z.town` zones, `TOWN_GROUND`, the zone palette instead of `OLD_PAL` | nothing |
| districts.js `zoneAt` | the street-name rules stay out of town zones | nothing |
| `applyDistrictHeights` | named unmeasured buildings take district storeys in town zones | nothing |
| src/danger-hud.js | `townAt` fallback for the neighbourhood name | the table entry |
| src/props.js | `ZONE_*` entries, block 12f (stalls at greengrocers) | the entries |
| src/lmc-towns.js | the file and `TOWN_LANDMARKS` | all three models (Sant'Agata, San Giuseppe, the Palchetto) |

## Not done (Villabate), for the next pass

- The pavements: the game paves every street with pale grid slabs and 2 to 3 m of kerb band; in Villabate they are narrow grey concrete kerbs. That is the streets layer (src/streets.js), not the district.
- Stone pines in the square on Via Terranova, the green-fenced noise barrier on the ring road, wires across the streets, planters at the bars, balconies glazed per flat, satellite dishes as geometry.
- A floating slab of balcony hangs over the street at Via Leonardo Sciascia and the south-east blocks (the same slab was there before this work): a `pwBalc` run on a building whose height is off.
- The east end of the town is outside the baked box (the baked box ends at x 8210); Corso Vittorio Emanuele towards Bagheria is not in the world.
- Facade of the Chiesa Madre: from the type, not from a photo.
