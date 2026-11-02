# Palermo Drive

*3 ruote 2 frecce 1 clacson 0 dignità.*

An irreverent driving game through Palermo in a lapa, in the browser. The whole city and Mondello are rebuilt from open
map and survey data, and you roam it freely, picking up whoever waves at you from the kerb.

**Play:** https://ebonura.github.io/palermo-drive/ (on a phone, turn it to landscape)

## What you can do

- Drive anywhere: from the Quattro Canti to Mondello, up Monte Pellegrino to Santa Rosalia, out to the ZEN and Brancaccio.
  Pick a start point on the city map or from the list of quartieri. The ground is the real ground: hills, river valleys,
  flyovers, underpasses and tunnels, the port with the Stazione Marittima, the Quattro Canti, the Cattedrale, La Zisa and La Cuba.
- **Fares:** tourists in the centro, regular taxi rides, urgent runs across town, and passengers who want to go "a pulle"
  at the Favorita, day and night. A timer, and a tip that grows with speed.
- **Food chases:** Benny has lost his pizzette, and he is not the only one. About forty places across the city (real
  ones and invented ones) send you hunting for panelle, arancine, cannoli and more, then chasing the scooter that stole them.
- **Races:** a sprint on Viale Regione Siciliana, laps at the Università and on Viale dell'Olimpo, and the night Corse
  clandestine in Viale delle Scienze, against tuned cars, lape, scooters and horse carriages. Finish in the first three and the prize goes in your wallet.
- **Pubs, after dark:** Krust on Via Dante with its metal crowd (and Terrorage playing outside), Lizard, Monkey, Whisky & Drink,
  Taverna Azzurra, PunkFunk, Piazza Magione and Sanlorenzo Mercato, each with an errand of its own. A few secrets are hidden around town;
  the Collezioni screen shows what you have found.
- **The crowd and the street:** the pedestrians are pixel-art people built from the Liberated Pixel Cup layers, in the quarter's own
  mix (nonne, students, tourists, tifosi, metal kids). Horse carriages carry tourists round the Cattedrale, the Quattro Canti and the
  Teatro Massimo, a painted carretto siciliano stands by the Cattedrale and Piazza Pretoria and wanders the Vucciria, Apes call out
  their sfincione and panelle, and AMAT buses and trams run their real routes.
- **Stadio Renzo Barbera:** drive in through the gate and onto the pitch, under stands full of rosanero tifosi.
- **The garage:** the Officina ru ziu Turiddu. Pick a vehicle, paint and tune it, and make your own driver ("Il tuo autista"), who then
  sits in the lapa. It is all saved in your browser.
- Collect the SUCA and 800A tags sprayed on walls all over town, outrun the police, and watch the neighbourhood's danger level.

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

Buildings, streets, parks and street furniture come from OpenStreetMap, checked against the Comune di Palermo's and the Regione
Siciliana's open data (street surfaces, building volumes, walls, trees, buses and trams). Ground and building heights come from the
national lidar survey, and the hills from open elevation models. Bridges, flyovers and tunnels are built from the mapped ones. Everything is baked offline into 500 m tiles
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
- Monumental trees: Regione Siciliana, Alberi Monumentali di Sicilia (open data, list updated 2021), CC BY, https://dati.regione.sicilia.it/dataset/alberi-monumentali-di-sicilia.
- Trees: Contains modified Copernicus Land Monitoring Service information: Urban Atlas Street Tree Layer 2018, European Environment Agency (EEA).
- Green areas (medians, islands, flowerbeds): Comune di Palermo, Perimetrazione aree verdi (open data), CC BY 4.0.
- Bus and tram routes, stops and timetables: AMAT Palermo S.p.A. open data, GTFS feed published by the Comune di Palermo (opendata.comune.palermo.it), CC BY 4.0. Tram line geometry follows OpenStreetMap (ODbL), as in the feed itself.
- Public drinking fountains: Comune di Palermo open data, "Dataset della dislocazione delle fontanelle per acqua potabile (AMAP)", data supplied by AMAP S.p.A., CC BY 4.0.
- Roof and ground colours derived from the Regione Siciliana SITR Ortofoto ATA 2012-2013 (Regione Siciliana, Assessorato Regionale del Territorio e dell'Ambiente, Dipartimento Urbanistica), CC BY 4.0. Colours were extracted and rebalanced; no imagery is included.
- Terrain: AWS Terrain Tiles (Mapzen terrarium; sources include SRTM).
- Radio music: Alamia e Sperandeo (Seamusica S.r.l., used with permission) and CC BY 4.0, CC0 and public domain tracks; Terrorage (used with permission) plays outside the Krust pub. Full attribution in `assets/music/CREDITS.md`.
- Photo facades: Wikimedia Commons photos, authors and licences in `assets/CREDITS.md`.
- Vehicles and textures are drawn in code. Sound effects are CC0, see `assets/CREDITS.md`.
- Pedestrian sprites (the street crowd, the stadium's tifosi, the coachmen and your own driver) are composed from layers of the Universal LPC Spritesheet Character Generator (Liberated Pixel Cup contributors) with our own painted details; authors, licences and links of every layer are in `assets/peds/lpc/CREDITS.md`, the licence note for that folder is `assets/peds/lpc/LICENSE.md`, and the atlas is rebuilt with `node tools/lpc/build.mjs`.
- three.js (MIT). Fonts: SIL Open Font License.

Design notes, faithfulness reviews, performance and security notes: `docs/` (`PERF.md`, `SECURITY.md`).

Created by Emanuele Bonura.
