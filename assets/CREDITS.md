# Asset credits (driving)

**Stu gioco è gratis e open source, si u pagaisti ti futtiaru i picciuli**

The player vehicles (three lape, three two-wheelers and a tamarro hatchback, with all tuning parts and sticker designs) are built procedurally in code<!-- src/vehicle-models.js and src/vehicle-art.js; the Calessino lapa is in src/vehicle.js -->; the Calessino "lapa" was the first, including the
three livery textures (royal blue, white and burgundy, and the hand-painted Sicilian cart folk-art pattern, all
drawn on canvases in code). No external model or texture is used for it.

<!-- Files still in this folder (assets/cars/) from the first car, kept for possible traffic use; not used by the player vehicle. -->

## Car model

Both are CC0 1.0 (public domain dedication, https://creativecommons.org/publicdomain/zero/1.0/).
No attribution is required, credit is given anyway.

| File | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- |
| The interface fonts (`ui/fonts/barlow-400.woff2`, `barlow-600.woff2`, `barlow-condensed-600.woff2`, `barlow-condensed-700.woff2`, `mr-dafoe.woff2`, `racing-sans-one.woff2`) | The four families' own designers, named on each family's page | Google Fonts, https://fonts.google.com (Barlow, Barlow Condensed, Mr Dafoe, Racing Sans One) | SIL Open Font License 1.1 | Latin subsets as WOFF2 |
| Sports hatchback model (`cars/hatchback-sports.glb`) | Kenney (www.kenney.nl) | Car Kit 3.1, https://kenney.nl/assets/car-kit (mirrored by the author at https://opengameart.org/content/car-kit) | CC0 1.0 | none |
| Colour map texture of the car kit (`cars/Textures/colormap.png`) | Kenney, Car Kit 3.1 | same as above | CC0 1.0 | the green paint swatch (x 192-255, y 128-255) was hue-shifted to red |

## Audio

The engine, horn melodies and subwoofer beat are synthesised in code<!-- Web Audio, src/vehicle-audio.js --> (no sample), and so are the traffic rumble, the cars passing by and the beeps of the traffic's horns<!-- src/city-audio.js -->. The recordings are: The short game sounds (menus, fares, missions, races, the police, things knocked over) and the wind, crickets, gulls, hooves and the tram's rumble are synthesised too<!-- src/sfx.js -->; the recordings among them are in the table.

| File | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- |
| Impact sound (`audio/impact.wav`) | Kenney | Starter Kit Racing<!-- audio/impact.ogg -->, https://github.com/KenneyNL/Starter-Kit-Racing | CC0 1.0 | converted to 22.05 kHz mono WAV |
| Tyre skid sound (`audio/skid.wav`) | Landeplage (https://github.com/Landeplage), as shipped in Kenney's Starter Kit Racing | same repository<!-- audio/skid.ogg --> | CC0 1.0 | converted to 22.05 kHz mono WAV, 50 ms crossfade at the loop point |
| L'arrotino's loudspeaker announcement (`audio/arrotino.m4a`) | Camelia.boban | ["Donne, è arrivato l'arrotino"](https://commons.wikimedia.org/wiki/File:Donne,_%C3%A8_arrivato_l%27arrotino.mp3), Wikimedia Commons (own work, recorded in the Monteverde quarter of Rome, 16 November 2022) | CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/) | converted to mono 24 kHz AAC and levelled; the loudspeaker sound is a filter applied while it plays<!-- src/city-audio.js -->, and the clip is looped with gaps. The clip and these edits stay CC BY-SA 4.0 |
| Car horns in the traffic (`audio/horns.m4a`) | keweldog ["car horn.wav"](https://freesound.org/people/keweldog/sounds/182474/), DeVern ["Car Horn Honk.wav"](https://freesound.org/people/DeVern/sounds/349922/), wanaki ["Car Horn_Irritated driver stuck in traffic.wav"](https://freesound.org/people/wanaki/sounds/569613/), csnmedia ["La cucaracha car Horn.wav"](https://freesound.org/people/csnmedia/sounds/388276/) | freesound.org | CC0 1.0 | seven horns cut from the four recordings (from the site's preview files), levelled and joined into one mono AAC file |
| The market quarter's voices (`audio/mercato.m4a`) | SUPERORI, ["mercato 1.wav"](https://freesound.org/people/SUPERORI/sounds/158419/) (a market in Palermo, Ballaro and Vucciria) | freesound.org | CC0 1.0 | filtered, levelled, a two second crossfade so that it loops, mono AAC |
| The jingles of a mission accepted, a big win and a mission failed (`audio/jingle-start.m4a`, `jingle-win.m4a`, `jingle-fail.m4a`) | Kenney | Music Jingles, `jingles_PIZZI15.ogg`, `jingles_PIZZI10.ogg`, `jingles_PIZZI07.ogg`, https://kenney.nl/assets/music-jingles | CC0 1.0 | converted to mono AAC |
| A car tapped or shunted (`audio/crash-light.m4a`) | qubodup, ["Clank Car Crash Collision"](https://freesound.org/people/qubodup/sounds/151624/) | freesound.org | CC0 1.0 | from the site's preview: trimmed, faded out, levelled to the same peak, mono AAC |
| A car hit hard (`audio/crash-heavy1.m4a`, `crash-heavy2.m4a`) | magnuswaker, ["Car Crash (with Glass)"](https://freesound.org/people/magnuswaker/sounds/592388/); Logicogonist, ["car crash long 1"](https://freesound.org/people/Logicogonist/sounds/807437/) | freesound.org | CC0 1.0 | from the site's preview: trimmed, faded out, levelled to the same peak, mono AAC |
| Glass breaking in a hard crash (`audio/glass1.m4a`, `glass2.m4a`) | DeezSoundzTho, ["bottle break.wav"](https://freesound.org/people/DeezSoundzTho/sounds/407431/); ElevatorFan2020, ["Hard Glass Break 2"](https://freesound.org/people/ElevatorFan2020/sounds/861043/) | freesound.org | CC0 1.0 | from the site's preview: trimmed, faded out, levelled to the same peak, mono AAC |
| A crate, a stall or a chair knocked over (`audio/wood-break.m4a`) | Bertsz, ["Wood Crate Destory 2"](https://freesound.org/people/Bertsz/sounds/500901/) | freesound.org | CC0 1.0 | from the site's preview: trimmed, faded out, levelled to the same peak, mono AAC |
| Rubbish, cardboard and hedges driven through (`audio/bags1.m4a`, `bags2.m4a`) | philberts, ["trash_fall.wav"](https://freesound.org/people/philberts/sounds/71512/); CANADIAN_DOG, ["CDOG_small_box_thud.wav"](https://freesound.org/people/CANADIAN_DOG/sounds/575290/) | freesound.org | CC0 1.0 | from the site's preview: trimmed, faded out, levelled to the same peak, mono AAC |
| Somebody sent flying (`audio/bonk1.m4a`, `bonk2.m4a`) | cb9382, ["Comedic Loud Bonk"](https://freesound.org/people/cb9382/sounds/871191/); insanity54, ["body_hit.wav"](https://freesound.org/people/insanity54/sounds/276600/) | freesound.org | CC0 1.0 | from the site's preview: trimmed, faded out, levelled to the same peak, mono AAC |
| A bin or a skip hit (`audio/bin-metal.m4a`) | qubodup, ["Loud Bang Crashing Metal Chunk Dropped in Metal Dumpster"](https://freesound.org/people/qubodup/sounds/859154/) | freesound.org | CC0 1.0 | from the site's preview: trimmed, faded out, levelled to the same peak, mono AAC |
| A sign or thin sheet metal hit (`audio/sign-metal.m4a`) | SamsterBirdies, ["Metal drop Streetsign 2"](https://freesound.org/people/SamsterBirdies/sounds/581595/) | freesound.org | CC0 1.0 | from the site's preview: trimmed, faded out, levelled to the same peak, mono AAC |
| A lamp post or any pole hit (`audio/pole-metal.m4a`) | Ev-Dawg, ["Metal Pole Hit"](https://freesound.org/people/Ev-Dawg/sounds/336000/) | freesound.org | CC0 1.0 | from the site's preview: trimmed, faded out, levelled to the same peak, mono AAC |
| A railing or a fence smashed (`audio/rail-metal.m4a`) | Ev-Dawg, ["Metal Railing Hit"](https://freesound.org/people/Ev-Dawg/sounds/335999/) | freesound.org | CC0 1.0 | from the site's preview: trimmed, faded out, levelled to the same peak, mono AAC |
| The tram's bell (`audio/tram-bell.m4a`) | Profispiesser, ["FXSaSc Berlin Tram Train Ring Bell Alexanderplatz.wav"](https://freesound.org/people/Profispiesser/sounds/543825/) | freesound.org | CC0 1.0 | from the site's preview: leading silence removed, first 5 s, faded out, mono AAC |
| The church bell (`audio/church-bell.m4a`) | Paul368, ["Italian church bell close up no background noise.WAV"](https://freesound.org/people/Paul368/sounds/369678/) (a church in Palermo) | freesound.org | CC0 1.0 | from the site's preview: 9 s from 1:18, faded out, mono AAC |
| Rain (`audio/rain.m4a`) | Victormaa, ["forest heavy rain loop.wav"](https://freesound.org/people/Victormaa/sounds/671409/) | freesound.org | CC0 1.0 | from the site's preview: 20 s, its end crossfaded into its start so it loops, loudness normalised, mono AAC |
| The sea (`audio/sea.m4a`) | madamdata, ["Waves at Punggol Beach"](https://freesound.org/people/madamdata/sounds/709210/) | freesound.org | CC0 1.0 | from the site's preview: 24 s from 0:06, crossfaded to loop, loudness normalised, mono AAC |
| Cicadas (`audio/cicadas.m4a`) | Nox_Sound, ["Ambiance_Cicadas_Loop_01.wav"](https://freesound.org/people/Nox_Sound/sounds/515055/) | freesound.org | CC0 1.0 | from the site's preview: 20 s, crossfaded to loop, loudness normalised, mono AAC |

## Traffic (src/traffic.js, assets/traffic/)

All vehicle models are built in code<!-- assets/traffic/models.js -->; no external model or texture is used.

The AMAT bus lines<!-- assets/traffic/bus-routes.js --> (line numbers, destinations, route geometry and the
stops attached to each route) are derived from OpenStreetMap bus route relations<!-- fetched with Overpass and
cached in data/bus_routes_osm.json; baked by assets/traffic/bake-bus.cjs -->; bus stop positions also come from OpenStreetMap<!-- data/props_osm.json -->.
Map data © OpenStreetMap contributors, available under the Open Database
Licence (ODbL), https://www.openstreetmap.org/copyright.

## World terrain data (world/, baked by `tools/tiles.py`)

The ground heights of the whole-city tiles come from three open datasets. Nothing is shipped as a file; the numbers are baked into the game's world data<!-- world/manifest.json and world/tiles/*.json, near and far grids -->.

| Data | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- |
| TINITALY 1.1 digital elevation model (10 m), used for Monte Pellegrino and the other hills | INGV, Istituto Nazionale di Geofisica e Vulcanologia (S. Tarquini et al.) | https://tinitaly.pi.ingv.it, https://doi.org/10.13127/tinitaly/1.1 | CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) | resampled to 10 m and 100 m grids, shifted toward the lidar where both exist, blended with the other terrain sources |
| PST-A lidar DTM (Regione Sicilia), rasters and point queries | Ministero dell'Ambiente e della Sicurezza Energetica, Geoportale Nazionale | http://wms.pcn.minambiente.it<!-- WMS GetMap and GetFeatureInfo --> | CC BY 4.0 | elevations decoded from the rendered layer, point queries above its 204 m clip, resampled to 10 m grids |
| Terrarium terrain tiles (far grid outside the hills) | Mapzen / AWS Open Data (sources include SRTM) | https://registry.opendata.aws/terrain-tiles/ | open data, see the registry entry | resampled to a 100 m grid |

## Building heights and extra footprints (world/, baked by `tools/tiles.py` from `tools/footprints.py`)

| Data | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- |
| Unita' Volumetriche, Carta Tecnica Comunale (2013, published 2021): eave heights and foot elevations, and the buildings OpenStreetMap lacks | Comune di Palermo | https://opendata.comune.palermo.it/opendata-dataset.php?dataset=1294 | CC BY 4.0 IT (https://creativecommons.org/licenses/by/4.0/deed.it) | volume polygons projected to game metres, merged into buildings, matched to OSM buildings; used where no lidar roof exists |

## Street surfaces (world/, baked by `tools/tiles.py` from `tools/road_surfaces.py`)

| Data | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- |
| Perimetrazione Area Stradale (dataset 280), Area di Circolazione Pedonale (281), Le aree pedonali (850, decree list) | Comune di Palermo | [dataset 280](https://opendata.comune.palermo.it/opendata-dataset.php?dataset=280), [dataset 281](https://opendata.comune.palermo.it/opendata-dataset.php?dataset=281), [dataset 850](https://opendata.comune.palermo.it/opendata-dataset.php?dataset=850) | CC BY 4.0 | reprojected to game metres and shifted 1.5 m east to the OSM roads; split into carriageway, pavement, verge and pedestrian-street polygons by width rules; combined with OSM road lines |

## Walls and fences (world/, baked by `tools/tiles.py` from `tools/fences.py`)

| Data | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- |
| Carta Tecnica Regionale 1:10.000, edition 2012-13: dividing walls, dry-stone walls, retaining walls, fences | Regione Siciliana | https://www.sitr.regione.sicilia.it/download/download-carta-tecnica-regionale-10000/ | CC BY 4.0 | lines clipped to the tiles, dropped where OSM has the same wall, on buildings and on roads; heights chosen by kind |

## Trees and green areas (world/, baked by `tools/tiles.py` from `tools/greenery.py`)

| Data | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- |
| Isolated trees, hedges (CTR 1:10.000, ed. 2012-13) | Regione Siciliana | https://www.sitr.regione.sicilia.it | CC BY 4.0 | points and lines baked into tiles, sizes from the lidar |
| Alberi Monumentali di Sicilia (list under L. 10/2013, updated 2021): position, species and height of the 42 single monumental trees of the Comune of Palermo | Regione Siciliana | https://dati.regione.sicilia.it/dataset/alberi-monumentali-di-sicilia | CC BY (as stated on the portal) | baked as tree props<!-- tools/monumental.py -->, replacing the generic trees at the same spot; crown size is a game value |
| Urban Atlas Street Tree Layer 2018 | Copernicus Land Monitoring Service, European Environment Agency (EEA) | https://land.copernicus.eu/local/urban-atlas | free, full and open, source acknowledged | canopy polygons turned into thinned tree positions |
| Perimetrazione aree verdi (medians, islands, verges, flowerbeds) | Comune di Palermo | https://opendata.comune.palermo.it/opendata-dataset.php?dataset=278 | CC BY 4.0 | polygons reprojected and drawn as grass over the street layers |

## Buses, trams and fountains (assets/traffic/bus-routes.js, assets/traffic/tram-lines.js, world/)

| Data | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- |
| AMAT Palermo GTFS feed (bus routes and stops, tram lines, stops and timetables), edition 20260825-20261031 | AMAT Palermo S.p.A., published by the Comune di Palermo | https://opendata.comune.palermo.it/opendata-dataset.php?dataset=1807 | CC BY 4.0 IT (tram lines georeferenced on OpenStreetMap, ODbL) | shapes thinned to 2 m, busiest pattern of each direction, tram paths matched to OSM tracks |
| Drinking fountains (AMAP list, 2019) | Comune di Palermo, AMAP S.p.A. | https://opendata.comune.palermo.it/opendata-dataset.php?dataset=1249 | CC BY 4.0 IT | those without an OSM node within 25 m become props |

## Roof and ground colours (world/, baked by `tools/tiles.py` from `tools/colours.py`)

| Data | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- |
| Ortofoto Regione Siciliana ATA 2012-2013 (15 cm and 25 cm): only colour values derived from it, no imagery | Regione Siciliana, Assessorato Regionale del Territorio e dell'Ambiente, Dipartimento Urbanistica, Nodo Regionale S.I.T.R. | https://www.sitr.regione.sicilia.it/geoportale/it/metadata/details/608 | CC BY 4.0 (as stated by the service record) | one colour per roof and one relative tint per 20 m ground cell, extracted, shadow-filtered and colour-rebalanced |


## Music: rights

All songs on the car radio remain the property of their artists and rights holders. They are played in a free, non-commercial game to support music from Palermo; no ownership of any song is claimed. A rights holder who wants a song credited differently or removed can write on Instagram to @izzy88izzy and it will be done promptly.

Tutti i brani della radio restano di proprietà dei rispettivi artisti e titolari dei diritti. Sono trasmessi in un gioco gratuito e senza scopo di lucro per far conoscere la musica palermitana; non si rivendica alcun diritto sui brani. Chi detiene i diritti e vuole un credito diverso o la rimozione di un brano può scrivere su Instagram a @izzy88izzy e sarà fatto subito.

## Car radio: Radio Abbanniata

Three free-licence tracks and the songs of Alamia e Sperandeo. Every track was re-encoded for the web and loudness normalised; nothing else changed. Full details in [the music credits](music/CREDITS.md).

| Title | Author | Licence | Source |
| --- | --- | --- | --- |
| Bushwick Tarantella | Kevin MacLeod (incompetech.com) | CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300002 |
| Tarantella (trad., arr. William Popp) | Air Force Strings, US Air Force Band | Public domain | https://commons.wikimedia.org/wiki/File:Tarantella.ogg |

## Alamia e Sperandeo

Songs by Giovanni Alamia and Tony Sperandeo. Rights holder: Seamusica S.r.l. (https://www.seamusica.shop/).

| Title | Author | Licence | Source |
| --- | --- | --- | --- |
| Abbiamo Arrivato | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Abbiamo Arrivato (2003) |
| Broadway (Un Sogno Americano) | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Estate '90 (2003) |
| Brutti, Sporchi E Monelli | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Brutti, sporchi e monelli (2003) |
| Cachi | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Brutti, sporchi e monelli (2003) |
| Canzoncine Per Bambini | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Trazzieri (2003) |
| Cu dici ca lu carceri è galera | Alamia e Sperandeo | Seamusica S.r.l. | Album not identified |
| Discorsi Di Taverna | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Brutti, sporchi e monelli (2003) |
| Inno Del Palermo | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Tutti per la press a (2003) |
| L'onorevole | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Tutti per la press a (2003) |
| La Bicicletta | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Estate '90 (2003) |
| La Farmacia | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Estate '90 (2003) |
| La Partita | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Estate '90 (2003) |
| La Punta | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Abbiamo Arrivato (2003) |
| La Scampagnata | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Estate '90 (2003) |
| Malacarne | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Trazzieri (2003) |
| Mare Mare | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Trazzieri (2003) |
| Minchia Pititto | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Abbiamo Arrivato (2003) |
| Passeggiando In Un Ponticello | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Brutti, sporchi e monelli (2003) |
| Passeggiata Alla Marina | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Trazzieri (2003) |
| Rap Ghiaccio | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Brutti, sporchi e monelli (2003) |
| Sai Che Ti Dico | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Trazzieri (2003) |
| Tirituppiti | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Attenti e cani (2003) |
| Tram Elettrico | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Estate '90 (2003) |
| Trazzieri | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Trazzieri (2003) |
| Tutti Per La Press | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Tutti per la press a (2003) |
| Una Giornata Qualunque | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Tutti per la press a (2003) |
| Una Storia Disonesta | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Estate '90 (2003) |
| Una Storia Osè | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Brutti, sporchi e monelli (2003) |
| Via Pitrè | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Estate '90 (2003) |
| Vucciria | Alamia e Sperandeo | ℗ 2003 Seamusica | Album Attenti e cani (2003) |

## Car radio: Radio Lamiera

Rock and metal from Palermo bands. Re-encoded for the web and loudness normalised; a few long video intros were cut so the song starts at once. DIY Violence by Terrorage also plays at the door of the Krust pub.

| Title | Author | Licence | Source |
| --- | --- | --- | --- |
| Fury of Hatred | Ego Divided | Independent release | Single Fury of Hatred (Sorry Mom!, 2026); album The Abyss (2026) |
| DIY Violence | Terrorage | Independent release | Album Close to Collapse (2026) |
| Rain from the Universe | Crimson Wind | ℗ 2011 Ice Warriors Records | Album The Wings of Salvation (2011). Music: Emanuele Bonura; lyrics: Alessio Taormina, Claudio Di Girolamo, Emanuele Bonura |
| Hold Your Dreams | Crimson Wind | ℗ 2011 Ice Warriors Records | Album The Wings of Salvation (2011). Music: Claudio Di Girolamo; lyrics: Alessio Taormina, Claudio Di Girolamo |
| The Court of Guilty Ones | Der Geist | ℗ Der Geist; publisher Tmina Records | Album The Pain We Don't Feel (2012) |
| Zombie Horde | The Ace Drops | Independent release | Single Zombie Hoard (2022). Riccardo Castiglione (vocals, bass, composer), Emanuele "Izzy" Bonura (guitars, arrangement) |
| Killerotomia | Trinakrius | Independent release (demo); Hellion Records (album) | Demo Psycho (2007); album The Black Hole Mind (2008) |
| Silver Thread | AnthiryA | Independent release | Promo Demo 2012 |
| U Viteddazzu | Cadaver Mutilator |  | Video Cadaver Mutilator & U malu chiffari (2007) |
| Scappeddami | Maddaus |  | Home recording (video, 2011) |
| Piombo | Diskonnekt | Music and lyrics by Diskonnekt | EP La Morte del Sole (2026) |
| Amore Ittico | Necrass | Qanat Records | EP Octopussy (2011) |
| The Chosen | Thy Majestie | Scarlet Records | Album Jeanne d'Arc (2005) |
| Seed of Revenge | Throne of Molok | Helvete & Hate Records | Album Chtonian A.E.O.N. 1010011010 (2007) |
| To The Truth | Lamiera | Independent release | EP To the Truth (promo, 2010) |
| The Fall | Meet My Maker | Music by Meet My Maker; lyrics by Marco Cappugi and Davide Nicosia | Single The Fall (2022) |
| Let Me Rot | Eraser | Independent release | Demo Fuck Off And Grind (2015) |
| Mutual Overkill Deterrence | Eraser | Night Animal Records | LP Mutual Overkill Deterrence (2020) |
| No Work | Stesso Sporco Sangue |  | Audio file sent by WhatsApp |

## Car radio: Radio Palifornia

Music from Palermo. Re-encoded for the web and loudness normalised.

| Title | Author | Licence | Source |
| --- | --- | --- | --- |
| 24 Luglio | Not Another Prayer | Independent release | Single 24 Luglio (2023) |
| Al Gelido Già Perso | Diastema |  | Studio recording |
| Spirito Funky | Enneo 2 feat. Dalila Galati e Izzy Bonura | ℗ & © 2014 Street Label Records | Video release (2014) |
| Dissociazione | Collateral Effect |  | First single (video, 2013) |
| Moto Continuo | Azzardo ft. SieroBrownie |  | MP3 sent by email |
| Aria Fresca | SieroBrownie |  | MP3 sent by email |
| 2 Am | magikAAAAArp |  | WAV file |
| Aura | Mario Bajardi |  | MP3 sent by email |
| My girlfriend is a nazi zombie | Loro |  | M4A sent by email |

## The Sicilian Wanderer

Dario Cascio, [The Sicilian Wanderer](https://www.youtube.com/@TheSicilianWanderer), Sicilian creator of the "Sessanta SeCunti" Shorts. In the game: the likeness cameo of him filming with his phone in Piazza Garraffello (the character, his look and the mission "The Sicilian Wanderer", all drawn and written for the game) and the radio station Sessanta SeCunti, made of his Shorts.

## Car radio: Radio Sessanta SeCunti

"Sessanta SeCunti" is a series of 60 second YouTube Shorts in Palermitan by Dario Cascio, [The Sicilian Wanderer](https://www.youtube.com/@TheSicilianWanderer). The station plays the audio of his 40 most viewed ones; the radio's bar has a button for the Short that is playing, and for his channel. Re-encoded for the web and loudness normalised.

| Title | Author | Source |
| --- | --- | --- |
| Mosè a Mondello | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/FDz8y6Q_CTU) |
| A Mmari Semu | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/vsSD2NtWf8Q) |
| Frischi e Pirita | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/H6W-4R6tdTk) |
| Chi Cosa Tinta | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/rWeAgMhOpKs) |
| Vuci Luntani | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/3XWhNzO-Az4) |
| Capruna | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/so0rvJp-sqA) |
| Par'Aieri | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/ZZUKLR7RBIY) |
| Lagnusu | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/1w5zxYhe-6Q) |
| Grazzi Santuzza | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/lj3VFS0ua0Y) |
| Broru | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/PM8ZXYgfj3A) |
| Quattr'e Rui | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/ws6urQ_OqnY) |
| San Martino | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/Bq4qdN8iC0A) |
| Ligna e Crape | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/YzxITU6KOj8) |
| U Zu Vanni | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/B659BZFu-2o) |
| Sauta A Jatta? | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/faboWgCwnZo) |
| Empedocle | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/hOMeIA5lWrQ) |
| Cu T'Addifenni, Palermo? | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/bBrRPW1RXes) |
| Ma Comu Finiu? | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/1ZhHW49HKzU) |
| Tu No | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/uD4aJ7fcGGM) |
| San Giovanni | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/FwE4z-J5ET4) |
| Don Pitruzzu All'Opira | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/qgnpnToLXpo) |
| Fera | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/HGHneSwt6VI) |
| Sparatrap | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/E5H88Bbl440) |
| Bandita | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/XtOKjL1jZC8) |
| Cafiata | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/xQ5wn7-Onio) |
| Via del 4 Aprile | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/11m3KRlNRWI) |
| Italianissa | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/F6r-wZup8QY) |
| 300 Liri | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/0ZYTb-eORGc) |
| Lucia Lucia | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/H5o59Lx3BdY) |
| A Miccè | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/9IfEO9ROE8Q) |
| 'A Fiera Ru Mediterraneo | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/ow-vSIA46dE) |
| Mali Vistuti | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/thE3pk5a4HU) |
| Palermitanismi | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/AHRGBRCbN3g) |
| Milicia | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/eWi4T94tNdE) |
| A Schifiu Finiu | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/b2Pjv0kEgbA) |
| Ammucca Lapuni | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/TfBr1VDNDd8) |
| Sarde | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/BYtnZevxQXY) |
| Villa Gardenia | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/n6XSXv93LtA) |
| Scarpuzzi | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/x09GKDhFzyM) |
| Pinu Tagghiacapiddi | Dario Cascio - The Sicilian Wanderer | [YouTube Short](https://www.youtube.com/shorts/3-R0r9P3sPg) |

## Pedestrian sprites (LPC)

The people are composed from layers of the [Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator) (the Liberated Pixel Cup art and its many contributors on OpenGameArt), plus our own painted details on top. Every layer used, with its authors, licences and links, is listed in [the sprite credits](peds/lpc/CREDITS.md); the licence note for that art (kept apart because part of it is share-alike) is [the sprite licence note](peds/lpc/LICENSE.md). Where a layer offers a permissive licence (CC0, CC-BY, OGA-BY) next to CC-BY-SA / GPL we use it under the permissive one. <!-- The atlas is rebuilt with node tools/lpc/build.mjs. -->
