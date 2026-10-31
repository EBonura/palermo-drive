# Asset credits (driving)

The player vehicle (a Piaggio Ape Calessino "lapa") is built procedurally in `src/vehicle.js`, including the
three livery textures (royal blue, white and burgundy, and the hand-painted Sicilian cart folk-art pattern, all
drawn on canvases in code). No external model or texture is used for it.

Files still in this folder from the first car, kept for possible traffic use:

All are CC0 1.0 (public domain dedication, https://creativecommons.org/publicdomain/zero/1.0/).
No attribution is required, credit is given anyway.

## Car model (not used by the player vehicle)

| File | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- |
| `cars/hatchback-sports.glb` | Kenney (www.kenney.nl) | Car Kit 3.1, https://kenney.nl/assets/car-kit (mirrored by the author at https://opengameart.org/content/car-kit) | CC0 1.0 | none |
| `cars/Textures/colormap.png` | Kenney, Car Kit 3.1 | same as above | CC0 1.0 | the green paint swatch (x 192-255, y 128-255) was hue-shifted to red |

## Audio (used)

The engine sound is synthesised with Web Audio in `src/vehicle.js` (no sample). The tyre and impact sounds are:

| File | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- |
| `audio/impact.wav` | Kenney | Starter Kit Racing, `audio/impact.ogg`, https://github.com/KenneyNL/Starter-Kit-Racing | CC0 1.0 | converted to 22.05 kHz mono WAV |
| `audio/skid.wav` | Landeplage (https://github.com/Landeplage), as shipped in Kenney's Starter Kit Racing | same repository, `audio/skid.ogg` | CC0 1.0 | converted to 22.05 kHz mono WAV, 50 ms crossfade at the loop point |

## Traffic (src/traffic.js, assets/traffic/)

All vehicle models are built in code (`assets/traffic/models.js`); no external model or texture is used.

The AMAT bus lines in `assets/traffic/bus-routes.js` (line numbers, destinations, route geometry and the
stops attached to each relation) are derived from OpenStreetMap bus route relations, fetched with Overpass and
cached in `data/bus_routes_osm.json`; bus stop positions also come from `data/props_osm.json`. Baked by
`assets/traffic/bake-bus.cjs`. Map data (c) OpenStreetMap contributors, available under the Open Database
Licence (ODbL), https://www.openstreetmap.org/copyright.

<!-- facade_photos:begin -->

## Photo facade textures (`facades/photo/`, built by `tools/facade_photos.py`)

Source photos are from Wikimedia Commons. Textures marked CC BY-SA 4.0 or 3.0 would make the derived texture share-alike; CC BY needs the credit shown; CC0 needs nothing (credit given anyway).

| Texture | Title | Author | Licence | Source | Changes |
| --- | --- | --- | --- | --- | --- |
| `facades/photo/riso.jpg` (Palazzo Belmonte Riso (Corso Vittorio Emanuele)) | Palazzo Belmonte Riso Palermo 2024-07-26 11.52.14.jpg | CSD2024 | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | https://commons.wikimedia.org/wiki/File:Palazzo_Belmonte_Riso_Palermo_2024-07-26_11.52.14.jpg | rectified and downscaled (perspective-corrected, obstructions painted out, colour-neutralised, 512 px max) |
| `facades/photo/gangi.jpg` (Palazzo Valguarnera-Gangi (Piazza Croce dei Vespri)) | Palazzo Gangi (Palermo) 14 07 2024 01.jpg | Effems | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | https://commons.wikimedia.org/wiki/File:Palazzo_Gangi_(Palermo)_14_07_2024_01.jpg | rectified and downscaled (perspective-corrected, obstructions painted out, colour-neutralised, 512 px max) |
| `facades/photo/jung_N.jpg` (Palazzo Jung (Via Abramo Lincoln)) | Palermo, Palazzo Jung 01.jpg | HaguardDuNord | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) | https://commons.wikimedia.org/wiki/File:Palermo,_Palazzo_Jung_01.jpg | rectified and downscaled (perspective-corrected, obstructions painted out, colour-neutralised, 512 px max) |

<!-- facade_photos:end -->
