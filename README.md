# Palermo Drive

*Tre ruote, zero frecce, un solo clacson.* An irreverent driving game through Palermo in a lapa, in the browser. Play it at
https://ebonura.github.io/palermo-drive/ (best on a phone in landscape, or desktop with WASD).

Built with three.js. Buildings, streets and street furniture come from OpenStreetMap; building and
ground heights from the Sicilian lidar survey; the hills around the Conca d'Oro from open terrain tiles.

## Run locally

```bash
python3 -m http.server 8790 --bind 127.0.0.1
```

then open http://localhost:8790. The baked map files are already in the repo. To rebuild them, see
`tools/` (`bake.py`, `lidar.py`, `streets.py`, `props.py`, `context.py`).

## Credits and licences

- Map data © OpenStreetMap contributors, licensed under the Open Database License (ODbL). The baked
  map files (`palermo-data.js`, `props-data.js`, `context-data.js`) are derived from it and are
  available under the ODbL too.
- Lidar DTM/DSM © Ministero dell'Ambiente e della Sicurezza Energetica, Geoportale Nazionale (CC BY 4.0).
- Terrain: AWS Terrain Tiles (Mapzen terrarium; sources include SRTM).
- Car model and sounds: see `assets/CREDITS.md` (CC0).
- three.js (MIT). Fonts: SIL Open Font License.

Created by Emanuele Bonura.
