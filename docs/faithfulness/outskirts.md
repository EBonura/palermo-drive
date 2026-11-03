# Outskirts: ground plains and street fences (round 2, item 2)

Files: `src/world.js` (terrain), `src/streets.js` (yard texture, polygon rule), `src/fence-walls.js` (new), `src/fences.js`, `src/wall-tex.js`.
Nothing here needs a re-bake: the tiles are untouched, everything is decided when a tile is built in the browser.

## What drew the pale slab plains

Three things, all in the data and all drawn as slabs because nothing told a pavement from a plain:

1. **The terrain's own inferred paving** (`aPave` in `terrainMesh`, board item 4): ground within 28 to 70 m of a building wall in a built-up quarter, with no land cover over it, was
   mixed towards pale stone and drawn with the `balate` slab texture. It was meant for squares and courtyards in the old town; in the outskirts it covered every yard, forecourt and
   lot between blocks, at Via Ciaculli (su24), Via Palmerino (su17), Via Filippo Paruta and a lot more. This was the main source.
2. **Wide `raised` polygons** (the Comune's pavement bands, merged with islands): at Via Messina Marine (su44) and Via Oreto (su02) a "pavement" 5 to 8 m wide is a hard shoulder,
   a lay-by or a lot, and was drawn with the pale grey `sidewalk` grid.
3. **Wide `paving` polygons** (plazas and car parks of the Comune plaza layer) outside the centre: the same, as forecourts and car parks.

## The rule

Terrain (the inferred ground, the main source): stone slabs stay in the historic centre, `histW` (src/streets.js), 1 within 2.2 km of the Quattro Canti and 0 at 3.0 km (the old town,
Libertà, Politeama, the port and Via Notarbartolo are inside). Beyond it the inferred ground becomes a **yard** (`TEX.yard`, `aYard`: cracked sun-bleached asphalt, packed dirt, dust,
tufts of dry weeds) with the same weight as before, except the first 3 m of ground beside the edge of a raised or paving polygon with a wall within 8 m, which stays slab: the apron
of a row of garages or shops (zi31) is a pavement. The edge distance is a second 5 m field next to the wall distance in `paveField`.

Polygons (raised, paving): a polygon becomes yard when all of these hold: it is beyond 1.8 km of the Quattro Canti and outside Mondello's garden region; its mean width (2 area /
perimeter, the cuts along the 62.5 m chunk grid not counted) is 4.6 m or more for raised and 9 m or more for paving; few walls stand within 45 m of it (density under 0.10: a wide
pavement or a village square among buildings stays slab); and it is not a kerbed island (kerbs along more than 80 % of its edge and under 6.5 m wide: the median of Viale Regione
Siciliana at su09 is one). su44, su02 and su26 pass; su09, Notarbartolo and the four village squares I picked (large paving polygons among buildings, 3.6 to 10 km from the Quattro Canti) do not.

Not done: kerbs and verge strips in the yards (the weeds are texture only). Dense quarters beyond 3 km with no pavement polygon (the foot of apartment blocks at a street corner, st1)
now draw as yard; I could not separate them from su24's plain with density, distance to a wall or to a pavement edge, and left it. Physics, pedestrians' walkable zones and the prop
masks read the data polygons, not the meshes, so nothing about driving changed. `PAVEZ` zones of the city landmarks stay slabs.

## Fences

The CTR fences (E002 "recinzione") within 8 m of a carriageway are re-read by stretch of 22 to 60 m (`roadsideWalls`). The choice uses what is behind the stretch: land cover that
is green or open on either side (park, field, pitch, orchard, cemetery: 85 % stay railings or chain-link), an open lot (nothing built within 14 m: 55 % stay, the rest mostly low walls
with a rail, then block and stone walls; a hoarding only on a stretch of 30 m or less and for 4 % of them), built-up street frontage (25 % stay, plaster, low walls with a rail, stone,
block), and the old town (60 % stay, the rest plaster, low walls and stone). Plaster stretches of 12 m or more are worn (patches, paper posters, death notices, tags) for 45 % of them. A
fence within 7 m of a tram rail always stays. The hash of the stretch start makes a tile build the same every time. A fence further than 8 m from a carriageway is unchanged, and so is its
collision: a converted piece sits on the same 2.5 m line, breaks at the same speed (2.6 m/s) and pushes the car back the same way. In an 80-tile sample about 22 km of 120 km of mapped
fence changed, 0.1 km of it to hoarding. Two new layers in the wall texture array (`x` worn plaster, `p` hoarding); stone and block reuse the rubble and concrete layers. No new draw calls.
`?nostreetwalls` shows the fences as mapped.

Not decided from data: the CTR tells nothing about height or material, so the mix is a judgement from the photos (lm26, su44, su18, su24, zi28), not a measurement.

## The floating slab at su17

It is the deck of the OSM bridge b81531217 (Via Palmerino over a brook, 11.4 m wide, layer 1), seen from the lane 3.5 m before it. The deck height is baked from the DEM at the two ends
(`y0` 85.64, `y1` 85.24); the ground the game runs on at the start of the deck is 84.1, so the deck stands 1.5 m above the approach, with the lane's asphalt cut away under it, and from
eye height the slab is a grey wall with a road dash on top. It is not drawn by a street layer or a fence. Not changed: a fix means moving the bridge's ends onto the runtime ground
(src/bridges.js `registerStructs`, which deliberately does not read the ground so that decks do not depend on which tiles are loaded) or baking a ramp, both bigger than a visual tweak.
I tried a steeper bank for brooks (the trench is 13 m from the camera, so it was not the cause) and reverted it.
