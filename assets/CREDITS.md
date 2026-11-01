# Asset credits (driving)

The player vehicles (three lape, three two-wheelers and a tamarro hatchback, with all tuning parts and sticker designs) are built procedurally in `src/vehicle-models.js` and `src/vehicle-art.js`; the Calessino "lapa" was the first (in `src/vehicle.js`), including the
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

The engine, horn melodies and subwoofer beat are synthesised with Web Audio in `src/vehicle-audio.js` (no sample). The tyre and impact sounds are:

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

## World terrain data (world/, baked by `tools/tiles.py`)

The ground heights of the whole-city tiles come from three open datasets. Nothing is shipped as a file here; the numbers are baked into `world/manifest.json` and `world/tiles/*.json` (`near` and `far` grids).

| Data | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- |
| TINITALY 1.1 digital elevation model (10 m), used for Monte Pellegrino and the other hills | INGV, Istituto Nazionale di Geofisica e Vulcanologia (S. Tarquini et al.) | https://tinitaly.pi.ingv.it, https://doi.org/10.13127/tinitaly/1.1 | CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) | resampled to 10 m and 100 m grids, shifted toward the lidar where both exist, blended with the other terrain sources |
| PST-A lidar DTM (Regione Sicilia), rasters and point queries | Ministero dell'Ambiente e della Sicurezza Energetica, Geoportale Nazionale | http://wms.pcn.minambiente.it (WMS GetMap and GetFeatureInfo) | CC BY 4.0 | elevations decoded from the rendered layer, point queries above its 204 m clip, resampled to 10 m grids |
| Terrarium terrain tiles (far grid outside the hills) | Mapzen / AWS Open Data (sources include SRTM) | https://registry.opendata.aws/terrain-tiles/ | open data, see the registry entry | resampled to a 100 m grid |

## Building heights and extra footprints (world/, baked by `tools/tiles.py` from `tools/footprints.py`)

| Data | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- |
| Unita' Volumetriche, Carta Tecnica Comunale (2013, published 2021): eave heights and foot elevations, and the buildings OpenStreetMap lacks | Comune di Palermo | https://opendata.comune.palermo.it/opendata-dataset.php?dataset=1294 | CC BY 4.0 IT (https://creativecommons.org/licenses/by/4.0/deed.it) | volume polygons projected to game metres, merged into buildings, matched to OSM buildings; used where no lidar roof exists |

## Street surfaces (world/, baked by `tools/tiles.py` from `tools/road_surfaces.py`)

| Data | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- |
| Perimetrazione Area Stradale (dataset 280), Area di Circolazione Pedonale (281), Le aree pedonali (850, decree list) | Comune di Palermo | https://opendata.comune.palermo.it/opendata-dataset.php?dataset=280, `=281`, `=850` | CC BY 4.0 | reprojected to game metres and shifted 1.5 m east to the OSM roads; split into carriageway, pavement, verge and pedestrian-street polygons by width rules; combined with OSM road lines |

## Walls and fences (world/, baked by `tools/tiles.py` from `tools/fences.py`)

| Data | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- |
| Carta Tecnica Regionale 1:10.000, edition 2012-13: dividing walls, dry-stone walls, retaining walls, fences | Regione Siciliana | https://www.sitr.regione.sicilia.it/download/download-carta-tecnica-regionale-10000/ | CC BY 4.0 | lines clipped to the tiles, dropped where OSM has the same wall, on buildings and on roads; heights chosen by kind |

## Trees and green areas (world/, baked by `tools/tiles.py` from `tools/greenery.py`)

| Data | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- |
| Isolated trees, hedges (CTR 1:10.000, ed. 2012-13) | Regione Siciliana | https://www.sitr.regione.sicilia.it | CC BY 4.0 | points and lines baked into tiles, sizes from the lidar |
| Urban Atlas Street Tree Layer 2018 | Copernicus Land Monitoring Service, European Environment Agency (EEA) | https://land.copernicus.eu/local/urban-atlas | free, full and open, source acknowledged | canopy polygons turned into thinned tree positions |
| Perimetrazione aree verdi (medians, islands, verges, flowerbeds) | Comune di Palermo | https://opendata.comune.palermo.it/opendata-dataset.php?dataset=278 | CC BY 4.0 | polygons reprojected and drawn as grass over the street layers |

## Photo facade textures (`facades/photo/`, built by `tools/facade_photos.py`)

Source photos are from Wikimedia Commons. Textures marked CC BY-SA 4.0 or 3.0 would make the derived texture share-alike; CC BY needs the credit shown; CC0 needs nothing (credit given anyway).

| Texture | Title | Author | Licence | Source | Changes |
| --- | --- | --- | --- | --- | --- |
| `facades/photo/riso.jpg` (Palazzo Belmonte Riso (Corso Vittorio Emanuele)) | Palazzo Belmonte Riso Palermo 2024-07-26 11.52.14.jpg | CSD2024 | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | https://commons.wikimedia.org/wiki/File:Palazzo_Belmonte_Riso_Palermo_2024-07-26_11.52.14.jpg | rectified and downscaled (perspective-corrected, obstructions painted out, colour-neutralised, 1024 px max) |
| `facades/photo/gangi.jpg` (Palazzo Valguarnera-Gangi (Piazza Croce dei Vespri)) | Palazzo Gangi (Palermo) 14 07 2024 01.jpg | Effems | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | https://commons.wikimedia.org/wiki/File:Palazzo_Gangi_(Palermo)_14_07_2024_01.jpg | rectified and downscaled (perspective-corrected, obstructions painted out, colour-neutralised, 1024 px max) |
| `facades/photo/jung.jpg` (Palazzo Jung (Via Abramo Lincoln)) | Palermo, Palazzo Jung 01.jpg | HaguardDuNord | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) | https://commons.wikimedia.org/wiki/File:Palermo,_Palazzo_Jung_01.jpg | rectified and downscaled (perspective-corrected, obstructions painted out, colour-neutralised, 1024 px max) |
| `facades/photo/biondo.jpg` (Teatro Biondo (Via Roma)) | Facciata del Teatro Biondo.jpg | Luca.favorido | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | https://commons.wikimedia.org/wiki/File:Facciata_del_Teatro_Biondo.jpg | rectified and downscaled (perspective-corrected, obstructions painted out, colour-neutralised, 1024 px max) |
| `facades/photo/palmes.jpg` (Grand Hotel et des Palmes (Via Mariano Stabile)) | Grand Hotel et des Palmes (Palermo) - Façade.jpg | HaguardDuNord | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) | https://commons.wikimedia.org/wiki/File:Grand_Hotel_et_des_Palmes_(Palermo)_-_Fa%C3%A7ade.jpg | rectified and downscaled (perspective-corrected, obstructions painted out, colour-neutralised, 1024 px max) |
| `facades/photo/malfitano.jpg` (Villa Malfitano) | Villa Malfitano - Façade .jpg | HaguardDuNord | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) | https://commons.wikimedia.org/wiki/File:Villa_Malfitano_-_Fa%C3%A7ade_.jpg | rectified and downscaled (perspective-corrected, obstructions painted out, colour-neutralised, 1024 px max) |
| `facades/photo/zisa.jpg` (Castello della Zisa (main front)) | La Zisa (Palermo) 19 06 2026 31.jpg | Effems | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | https://commons.wikimedia.org/wiki/File:La_Zisa_(Palermo)_19_06_2026_31.jpg | rectified and downscaled (perspective-corrected, obstructions painted out, colour-neutralised, 1024 px max) |
| `facades/photo/borsa.jpg` (Grand Hotel Piazza Borsa (ex Cassa di Risparmio)) | Cassa di Risparmio (Palermo).jpg | HaguardDuNord | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) | https://commons.wikimedia.org/wiki/File:Cassa_di_Risparmio_(Palermo).jpg | rectified and downscaled (perspective-corrected, obstructions painted out, colour-neutralised, 1024 px max) |
| `facades/photo/giustizia.jpg` (Palazzo di Giustizia (Piazza Vittorio Emanuele Orlando)) | Palazzo di Giustizia (Palermo) 19 06 2026 01.jpg | Effems | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | https://commons.wikimedia.org/wiki/File:Palazzo_di_Giustizia_(Palermo)_19_06_2026_01.jpg | rectified and downscaled (perspective-corrected, obstructions painted out, colour-neutralised, 1024 px max) |

<!-- facade_photos:end -->

## Car radio (src/radio.js, assets/music/)

Four tracks (plus the Alamia e Sperandeo songs below), details and the full attribution text in `music/CREDITS.md`. Re-encoded to MP3 for the web (loudness
normalised, nothing else changed).

| File | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- |
| Bushwick Tarantella | Kevin MacLeod (incompetech.com) | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300002 | CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) | web re-encode |
| Meatball Parade | Kevin MacLeod (incompetech.com) | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500014 | CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) | web re-encode |
| Tarantella (trad., arr. William Popp) | Air Force Strings, US Air Force Band | https://commons.wikimedia.org/wiki/File:Tarantella.ogg | Public domain | web re-encode |
| Funiculì, Funiculà (1903) | Ferruccio Giannini, Royal Marine Band of Italy (Victor) | https://commons.wikimedia.org/wiki/File:Victor_C-2404_%28Ferruccio_Giannini%29.wav | Public domain | web re-encode, mono |

## Alamia e Sperandeo

Thirty-two songs by Alamia e Sperandeo. Rights holder: Seamusica S.r.l. (https://www.seamusica.shop/). Used with the permission of the rights holders. Re-encoded for the web and loudness normalised, nothing else changed. Full list with file names in `music/CREDITS.md`.

| Title | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- |
| Abbiamo Arrivato | Alamia e Sperandeo | https://www.youtube.com/watch?v=fGn45VtSeak | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Acqua Di Cielo | Alamia e Sperandeo | https://www.youtube.com/watch?v=MSM2u1TkLB8 | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Broadway (Un Sogno Americano) | Alamia e Sperandeo | https://www.youtube.com/watch?v=PrfgC5KPNnw | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Brutti, Sporchi E Monelli | Alamia e Sperandeo | https://www.youtube.com/watch?v=KiXRogGmKNc | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Cachi | Alamia e Sperandeo | https://www.youtube.com/watch?v=occgwmI21wU | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Canzoncine Per Bambini | Alamia e Sperandeo | https://www.youtube.com/watch?v=JwbdVcSCwjs | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Ciauru Ro Mari | Alamia e Sperandeo | https://www.youtube.com/watch?v=kZFV6Lel2Bw | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Cu dici ca lu carceri è galera | Alamia e Sperandeo | https://www.youtube.com/watch?v=4GKJl8_NwGE | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Discorsi Di Taverna | Alamia e Sperandeo | https://www.youtube.com/watch?v=uAnUc997NEg | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Inno Del Palermo | Alamia e Sperandeo | https://www.youtube.com/watch?v=jGS8U6geDA4 | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| L'onorevole | Alamia e Sperandeo | https://www.youtube.com/watch?v=E-trP-b8LjY | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| La Bicicletta | Alamia e Sperandeo | https://www.youtube.com/watch?v=YxYntoyESU4 | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| La Farmacia | Alamia e Sperandeo | https://www.youtube.com/watch?v=Rz5TUYrB_CI | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| La Partita | Alamia e Sperandeo | https://www.youtube.com/watch?v=bJk2g9PJAYs | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| La Punta | Alamia e Sperandeo | https://www.youtube.com/watch?v=9FNlH6T41PY | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| La Scampagnata | Alamia e Sperandeo | https://www.youtube.com/watch?v=VKFUETsJpbI | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Malacarne | Alamia e Sperandeo | https://www.youtube.com/watch?v=3Wix5sFX_cI | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Mare Mare | Alamia e Sperandeo | https://www.youtube.com/watch?v=mUT7X0pJapw | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Minchia Pititto | Alamia e Sperandeo | https://www.youtube.com/watch?v=fOGJhwdb564 | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Passeggiando In Un Ponticello | Alamia e Sperandeo | https://www.youtube.com/watch?v=JVznrvl9t-I | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Passeggiata Alla Marina | Alamia e Sperandeo | https://www.youtube.com/watch?v=FbmX0Zhwr4M | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Rap Ghiaccio | Alamia e Sperandeo | https://www.youtube.com/watch?v=dU3uhhuFbAw | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Sai Che Ti Dico | Alamia e Sperandeo | https://www.youtube.com/watch?v=eGumdkiQiMA | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Tirituppiti | Alamia e Sperandeo | https://www.youtube.com/watch?v=1JuVwrhCDio | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Tram Elettrico | Alamia e Sperandeo | https://www.youtube.com/watch?v=2CtOgkHVqyE | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Trazzieri | Alamia e Sperandeo | https://www.youtube.com/watch?v=NN5rMO9mZ-U | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Tutti Per La Press | Alamia e Sperandeo | https://www.youtube.com/watch?v=x-tVoszt2y4 | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Una Giornata Qualunque | Alamia e Sperandeo | https://www.youtube.com/watch?v=ssJRaQqCn9I | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Una Storia Disonesta | Alamia e Sperandeo | https://www.youtube.com/watch?v=2rKWJn2QJh8 | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Una Storia Osè | Alamia e Sperandeo | https://www.youtube.com/watch?v=jgTvbsjmHNQ | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Via Pitrè | Alamia e Sperandeo | https://www.youtube.com/watch?v=4IKpMnQRLvY | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |
| Vucciria | Alamia e Sperandeo | https://www.youtube.com/watch?v=xjldjsJ5f_c | Seamusica S.r.l., used with permission of the rights holders | re-encoded, loudness normalised |

## Terrorage

One song, "DIY Violence" by Terrorage (`music/terrorage.m4a`), played at the door of the Krust pub (src/pubs.js). Used with the permission of the band. Re-encoded for the web (HE-AAC, about 40 kbps) and loudness normalised, nothing else changed. Details in `music/CREDITS.md`.

