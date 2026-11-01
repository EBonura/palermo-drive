# Palermo Drive

*3 ruote 2 frecce 1 clacson 0 dignità.*

An irreverent driving game through Palermo in a lapa, in the browser. The whole city and Mondello are rebuilt from open
map and survey data, and you roam it freely, picking up whoever waves at you from the kerb.

**Play:** https://ebonura.github.io/palermo-drive/ (on a phone, turn it to landscape)

## What you can do

- Drive anywhere: from the Quattro Canti to Mondello, up Monte Pellegrino to Santa Rosalia, out to the ZEN and Brancaccio.
  Pick a start point on the city map or from the list of quartieri.
- **Fares:** tourists in the centro, regular taxi rides, urgent runs across town, and passengers who want to go "a pulle"
  at the Favorita, day and night. A timer, and a tip that grows with speed.
- **Food chases:** Benny has lost his pizzette, and he is not the only one. About forty places across the city (real
  ones and invented ones) send you hunting for panelle, arancine, cannoli and more, then chasing the scooter that stole them.
- **Races:** a sprint on Viale Regione Siciliana, laps at the Università and on Viale dell'Olimpo, and the night Corse
  clandestine in Viale delle Scienze, against tuned cars, lape, scooters and horse carriages.
- Collect the SUCA and 800A tags sprayed on walls all over town, outrun the police, and tune your ride in the garage.

## Controls

| | Keyboard | Phone |
| --- | --- | --- |
| Drive | WASD or arrow keys | pads on both sides |
| Handbrake | Space | FRENO |
| Nitro | Shift | NOS |
| Horn | H | CLACSON |
| Menu | Esc or P | the button top left |
| Radio | M next track, N on/off | in the menu |

## How the city is made

Buildings, streets, parks and street furniture come from OpenStreetMap. Ground and building heights come from the
national lidar survey, and the hills from open elevation models. Everything is baked offline into 500 m tiles
(`world/`), which the game streams around you at two levels of detail.

The baked files are in the repo, so you only need the tools to change the map:

- `tools/tiles.py` builds the world tiles; `tools/tiles.py --terrain-only` rebakes just the ground.
- `tools/lidar.py`, `tools/lidar_hills.py` and `tools/dem.py` fetch and decode the elevation data.
- `tools/startmap.py` rebuilds the start-screen map after a tile rebake.
- `node assets/missions/snap-places.mjs` snaps the event places in `src/event-places.js` to the roads.
- `tools/terrain_check.py` and `tools/terrain_truth.py` check the roads against the terrain and the lidar.

The Python tools run in `tools/.venv`. Design notes, faithfulness reviews and performance rules are in `docs/`.

## Run it locally

```bash
python3 -m http.server 8790 --bind 127.0.0.1
```

Then open http://localhost:8790. Every push to `main` builds the site (`tools/build`, which packs the data into a
compact binary format) and publishes it to GitHub Pages.

## Credits and licences

- Map data © OpenStreetMap contributors, Open Database License (ODbL). The baked map files (`world/`,
  `palermo-data.js`, `props-data.js`, `context-data.js`, `assets/ui/startmap.json`) are derived from it and are
  available under the ODbL too.
- Lidar DTM/DSM © Ministero dell'Ambiente e della Sicurezza Energetica, Geoportale Nazionale, CC BY 4.0.
- Hills (Monte Pellegrino and the ridges around the city): TINITALY 1.1 DEM © INGV (Tarquini et al.), CC BY 4.0,
  https://doi.org/10.13127/tinitaly/1.1.
- Building volumes and heights: Comune di Palermo, Carta Tecnica Comunale, Unita' Volumetriche (2013), CC BY 4.0 IT,
  https://opendata.comune.palermo.it/opendata-dataset.php?dataset=1294.
- Street surfaces: Comune di Palermo, Perimetrazione area stradale and Aree pedonali (open data), CC BY 4.0,
  https://opendata.comune.palermo.it/opendata-dataset.php?dataset=280.
- Walls, fences, hedges and trees: Regione Siciliana, Carta Tecnica Regionale 1:10.000 (ed. 2012-13), CC BY 4.0.
- Trees: Contains modified Copernicus Land Monitoring Service information: Urban Atlas Street Tree Layer 2018, European Environment Agency (EEA).
- Green areas (medians, islands, flowerbeds): Comune di Palermo, Perimetrazione aree verdi (open data), CC BY 4.0.
- Terrain: AWS Terrain Tiles (Mapzen terrarium; sources include SRTM).
- Radio music: Alamia e Sperandeo (Seamusica S.r.l., used with permission) and CC BY 4.0, CC0 and public domain tracks; Terrorage (used with permission) plays outside the Krust pub. Full attribution in `assets/music/CREDITS.md`.
- Photo facades: Wikimedia Commons photos, authors and licences in `assets/CREDITS.md`.
- Vehicles, characters and textures are drawn in code. Sound effects are CC0, see `assets/CREDITS.md`.
- three.js (MIT). Fonts: SIL Open Font License.

Created by Emanuele Bonura.
