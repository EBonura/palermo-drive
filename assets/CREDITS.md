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
