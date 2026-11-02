# Palermo Drive: notes for agents working in parallel

Goal: an irreverent, edgy driving game soaked in Palermitan culture (GTA/taxi spirit, you drive a lapa), set in the most faithful PS2-era rendition of Palermo we can build in three.js
(textured low/mid-poly, 256 to 512 px tiled procedural textures, vertex-colour AO, baked detail).
Faithfulness to the real city beats everything else. One mode only, free roaming: you pick a start point (map or list) and drive, and objectives
(fares, taxi challenges, collection events, races) are scattered across the map by area. The shell is a main menu and one in-game side menu,
with checkerboard transitions that also hide loading.

## Layout and ownership

Several agents work at once in this folder. Edit only the files you own.

| File | Owner |
| --- | --- |
| `index.html`, `src/main.js`, `src/core.js`, `tools/bake.py`, `tools/lidar.py`, `tools/streets.py`, `palermo-data.js`, `data/*` (except your own new files) | core (lead) |
| `src/buildings.js` | buildings/facades agent |
| `src/props.js`, `tools/props.py`, `data/props_osm.json`, `props-data.js` | props agent |
| `src/landmarks.js` | landmarks agent |
| `src/context.js`, `tools/context.py`, `data/context_osm.json`, `context-data.js` | context agent |
| `src/vehicle.js`, `src/mobile.js`, `src/mobile.css`, `assets/cars/`, `assets/audio/` | driving agent |
| `src/ui.js`, `src/ui.css`, `assets/ui/` | game-shell agent |
| `src/traffic.js`, `assets/traffic/` | traffic agent |
| `src/pedestrians.js`, `assets/peds/` (and removing the static pedestrians from `src/props.js`) | pedestrian agent |
| `src/missions.js`, `assets/missions/`, plus small additions to `src/pedestrians.js` (scripted characters) and `src/ui.js` (menu entries, copy/tone) | missions agent |
| `server/`, `src/net.js`, plus a small model-builder export in `src/vehicle.js` | multiplayer agent |
| `src/roadwear.js`, `assets/roadwear/`, plus small additions to `src/vehicle.js` (bump/jolt input, skid state) | road-wear agent |
| `src/sea.js`, `assets/sea/` (water, shore, boats, drowning game over) | sea agent |
| `src/horn.js`, `src/shouts.js` | lead |
| `src/landmarks-city.js` (city-wide landmark models, instantiated per tile by world.js) | city landmarks agent |
| district zones and palettes in `src/buildings.js`, `docs/districts.md` | district agent |
| `src/world.js`, `src/streets.js` | streaming agent |
| `src/districts.js` | district agent |
| `src/suca.js` (graffiti collectibles) | lead |
| `src/vehicle-events.js` (ZEN gag, corse clandestine), `src/garage.js` | vehicles agent |
| `assets/peds/px.js`, `assets/peds/head.js`, `assets/peds/figure.js` | sprites agent |
| `src/daynight.js` (+ small hooks in props/buildings/vehicle/sea for night) | day/night agent |
| `src/traffic.js`, `src/police.js`, `src/gags.js`, `src/carrozze.js`, `src/vendors.js`, `assets/traffic/police-models.js` | police agent |
| `src/pedestrians.js`, `assets/peds/`, `src/missions.js`, `assets/missions/` | nightlife agent |
| `tools/build/`, `.github/workflows/`, build/deploy pipeline, data codecs, three.js upgrade (coordinates module changes with owners) | performance agent |

If you need something changed in a file you don't own (a new helper in core.js, a new field in the
baked data), say so in your final report instead of editing it. You may copy small helpers into your own module.

## How the world is set up

- Units are metres. Local projection centred on Quattro Canti: `x` east, `z` south, `y` up
  (metres above sea level). `proj(lat, lon)` in `src/core.js` returns `[x, z]`.
- `window.PALERMO_DATA` (from `palermo-data.js`, rebaked by the lead every few minutes, never edit it):
  - `buildings[]`: `{id, p: flat [x,z,...] outer ring, holes?, h (estimated height), r? (lidar roof
    elevation, absolute), g? (lidar ground), parts? [[flatPoly, roofElevation], ...], split?, c (stable
    random int), k?:'church', n? name, t? building type, lv? levels, hi? historic, am? amenity}`.
  - `roads[]`: `{w, k: highway class, p: flat centreline, n? name}`; `areas[]`: parks/plazas/water/piers.
  - `streets`: polygon layers `asphalt`, `paving` (stone, pedestrian), `raised` (sidewalks, piazzas,
    courtyards, 0.15 m high), `green`, `water`, each `[[outer, hole, ...], ...]` flat rings; `curbs[]`
    polylines with the road on their left.
  - `labels[]`: named buildings with centroid `x, z`.
  - `near`/`far`: terrain grids. Until the lidar run finishes there is no `near`, the centro is flat at
    y = 0 and buildings stand at their measured height above it. Always place things with
    `groundY(x, z)` (plus `ctx.CURB` on raised ground: `ctx.raisedMask(x, z)`), never a constant.
- `src/main.js` calls, in order: `prepareLandmarks(ctx)`, `buildBuildings(ctx)`, `buildLandmarks(ctx)`,
  `buildProps(ctx)`, `buildContext(ctx)`. `ctx = { scene, renderer, skip: Set of building ids a
  landmark replaces, raisedMask, CURB }`. Add meshes to `ctx.scene`.
- Collision is 2D against building footprints in main.js; models must stay inside footprints or in
  places a car can't reach anyway.
- Lighting: physical sky, sun from the WSW at about 26 degrees, ACES tone mapping, shadows from one
  directional light. Use `MeshStandardMaterial` (or Lambert for very cheap props). Merge geometry and use
  `InstancedMesh`: thousands of separate meshes will kill the frame rate. Budget roughly: buildings
  under 1.5M triangles, props under 300k, landmarks under 150k, context under 300k.
- Three.js r187 from the import map (`three`, `three/addons/...`), pinned in `tools/build/package.json` and `index.html`; the published site is built by `tools/build` (see `docs/PERF.md` for the rules that keep it small and fast: import `THREE` where you use it and never re-export the namespace, vColor is a vec4 in custom shaders, no `Math.hypot` in per-frame loops, no per-frame allocations).

## References

- `docs/palermo-style-guide.md`: colours, materials, dimensions from real photos (written by a
  research agent; if it isn't there yet, start on geometry and check back).
- Public photos on Wikimedia Commons are fine to look at for reference (download thumbnails to a new
  empty folder under `/private/tmp/claude-501/`, view them with Read). Don't copy photos into the game.
- Data sources must allow reuse (OSM ODbL, CC BY, CC0). No Google Maps/Street View content.

## Testing

The server runs at http://localhost:8790 (don't start another). Screenshot with headless Chrome:

```
tools/shot.sh /private/tmp/claude-501/<yourname>-1.png "campos=X,Y,Z&look=X,Y,Z"
tools/shot.sh /private/tmp/claude-501/<yourname>-2.png "spot=2&cam=0&turn=90"
```

Then look at the PNG with Read. It prints page console errors after the shot, fix any your module
causes. Spots: 1 Quattro Canti (0,0), 2 Teatro Massimo, 3 Cattedrale, 4 Palazzo dei Normanni,
5 Piazza Pretoria, 6 La Cala, 7 Stazione. Cameras: 0 chase, 1 high chase, 2 bonnet, 3 top-down.
A shot takes about 15 s. Compare against reference photos and iterate. Keep a note of what you
changed and anything you couldn't do.
