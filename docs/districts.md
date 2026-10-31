# Districts: what each part of Palermo looks like, and how buildings.js renders it

Zones, palettes and storey tables live in `src/districts.js` (pure data, testable in node). The styles and their textures are in
`src/buildings.js`. `tools/district-view.html` + `tools/district-shot.sh` render real world tiles on flat ground with nothing else loaded,
which is how every district below was checked: `tools/district-shot.sh out.png "campos=x,y,z&look=x,y,z&tiles=i_j,..."`.

## How it works

- **Zone lookup.** `zoneAt(x, z, streetName, distToStreet)`. Street rules first (Via della Liberta, Viale Strasburgo, Via Notarbartolo,
  Corso dei Mille, Via Oreto, plus the centro's Via Roma / Maqueda / Corso rules), then a weighted Voronoi over ~110 hand-placed seeds
  (`SEEDS`, lat/lon plus a reach in metres). Nothing claimed falls back to `centro` within 1.5 km of Quattro Canti, otherwise `periph`.
  Seed positions are anchored on OSM street names and place names found in the tiles (Piazza Borgo Vecchio, Piazza Noce, Via Gino Zappa,
  Via Barcarello, Piazza Valdesi ...) and on Wikipedia/Commons coordinates.
- **Storeys.** Measured (lidar) heights, OSM `building:levels`, named, church, historic and typed buildings are never touched. For the
  remaining ~38k buildings the baked height is just "3 to 6 floors", so `applyDistrictHeights(tile)` (idempotent) rewrites `h` from the
  zone's storey table (`fl`, weighted, deterministic per building position, capped by footprint so a 60 m2 house is never an 8-storey
  tower). `buildBuildingsIter` calls it itself; `world.js` should also call it right after a tile is parsed so the low-detail extrusions use
  the same heights (see the report). Net effect: 7 to 10 storeys along Via Liberta and its grid, 4 to 7 in the 1960s belts, 2 to 5 in
  Sferracavallo and Mondello, 1 to 3 in the park and countryside.
- **Styles.** New zones have `elig: true`: each style is only offered where it exists (Liberty villini are low, sacco blocks are 5+ floors,
  ZEN insulae are big, sheds are large). The centro zones keep their original behaviour.
  `lib` Liberty villino, `blk` 1960s-70s block (continuous balcony on every floor, tapparelle, drop awnings, marble lobby, pilotis),
  `pal` 1980s palazzina (one balcony per bay), `ins` public-housing slab (prefab panels, ribbon windows, exterior stairwell bays),
  `fish` fishermen's / summer house, `ind` shed, `silo` (round footprints in shed zones), `ruin` (bombed shell or rubble lot).
- **Decay** is `grime` (soot and desaturation, vertex colour), `pStone` (bare tufa showing), the `ruin` rate and the old peeling-plaster
  tiles. **Roofs**: `roof` multiplies the chance of a pitched tile roof (0 on ZEN and the blocks, 1.4 to 1.6 on Mondello, Valdesi and the park);
  sheds get corrugated metal, ruins rubble, the Mondello lido timber decks.

Reading the colours: palettes are multiplied up by `buildings.js` (x1.3, desaturated by grime) so they are roughly albedo / 1.15. Hexes below
are eyeballed and, where stated, measured from thumbnails; they include the photo's lighting.

## Photo evidence per district

Commons is thin on ordinary residential streets (most geotagged files are monuments), so some districts have one or two usable photos and
some none. Where there is no photo the description is from general knowledge and OSM geometry and is marked **(est.)**. All photos are
references only, nothing is copied into the game.

### Via della Liberta, Politeama, the sacco di Palermo grid
Photos: `Viale della libertà palermo.JPG` (PD), `Viale della Libertà Palermo 2024.jpg` (CC0), `Via Notarbartolo, Palermo 2026.jpg` (CC BY-SA 4.0),
`Palermo, Piazza Marchese di Regalmici - Palazzo Tagliavia.jpg` (CC BY 4.0), `Via notarbartolo Palermo.jpg` (PD), `Via leonardo da vinci.jpg`
(CC BY 3.0), `Piazza Politeama - Palermo - panoramio.jpg` (CC BY 3.0), `Centro palermo e piazza politeama dall'alto.jpg`,
`Passaggio a livello via Notarbartolo (Palermo) 01.jpg` (PD, 1950: the same area before the blocks).
- Via Liberta: wide plane-tree boulevard. Left and right alternate 19th c. palazzi (warm ochre to brown, green shutters, stone balconies,
  5 floors) with 8 to 10 storey blocks from the 1960s. Liberty villini between them (Villino Ida Basile: white plaster, dark brown shutters,
  flat roof with a stepped parapet; Villino Basile on Via Siracusa: pale grey-cream with a wrought-iron balcony).
- The side streets (Notarbartolo, Principe di Paterno, Strasburgo): orange-ochre (`#d08a4a` lit), cream, terracotta blocks of 8 to 10
  storeys, a continuous balcony on every floor with a solid white parapet, roller shutters in brown/cream/green, drop awnings, shops and
  marble lobbies below. Palazzo Tagliavia (corner of Piazza Regalmici): gold-ochre `#d8aa5a`, 5 floors, stone balconies.
- Viale Leonardo da Vinci / Viale Regione Siciliana: 12 to 16 storey towers in brown, terracotta and beige (`#9a6a52` to `#c9b58a`).
- Politeama grid (aerial): dense 5 to 7 storey cream, pink and white blocks, flat roofs; palazzi around the piazza are grey-green and ochre stucco.
- Heights: 4 to 10 on the grid, up to 12 on the avenues, `viaLib` has the 3 to 10 mix.

### Borgo Vecchio
Photos: `Palermo - Borgo Vecchio 0491.JPG` (CC BY-SA 4.0: a shrine and carved door in grey-ochre peeling plaster, brown wood door),
`July 2022 in Palermo (l).jpg` (CC BY-SA 4.0: tan 10 to 14 storey towers on the quay, `#b49a70`), Piazza Borgo Vecchio in OSM.
Working-class 19th c. fabric with 1950s infill: 3 to 5 storeys, ochre and tan plaster, heavy grime, a few post-war towers on the waterfront.

### Kalsa and Albergheria (and the gaps)
Photos: `Kalsa, Palermo, Italy - panoramio (20).jpg` (CC BY-SA 3.0), `Albergheria, Palermo, Italy - panoramio.jpg` (CC BY-SA 3.0: a long
palazzo in dark weathered tufa, `#a08050`), `Palermo - Albergheria 0777.jpg` (ochre and yellow houses, laundry, a bell tower),
`Chiesa dello Spasimo` photos (CC BY-SA 4.0: the church left roofless since 1943), style guide photos (Ballaro, Via Maqueda).
Three to five storeys of ochre and pale plaster peeling to golden-brown tufa, Liberty and baroque palazzi among plain houses, post-war
concrete infill. The wartime gaps are modelled as `ruin`: a shell or rubble lot 1.7 to 4.9 m high with exposed stone, black openings and
weeds (7 % of small buildings in the Kalsa, 6 % in Albergheria). Collision is unchanged (it comes from the footprints).

### Noce, Zisa, Cuba
Photos: `Montagna rifiuti - panoramio.jpg` (Via Aversa / Poliziano: cream-grey 1960s blocks with curved balconies), `Castello Zisa 1.jpg`,
`Palermo, la Cuba (2024) 15.jpg` (the Norman monuments in the middle of 4 to 6 storey housing). Noce: 4 to 6 storey 1950s-60s blocks;
Zisa and Cuba: low old houses, blocks and the old industrial plots of the Cantieri Culturali (`ind` weight 0.1).

### Stazione, Oreto, Brancaccio, Corso dei Mille
Photos: `Piazza Giulio Cesare (Palermo) 14 07 2024 02.jpg` (CC0) and `Palermo - Piazza Giulio Cesare.jpg`: cream-ochre neoclassical blocks with
corner towers opposite the station (`#d9c79a`); `Corso dei Mille, Palermo 2026.jpg` (CC BY 4.0): rose and salmon 19th c. palazzi, stone
balconies, shops below, 4 to 5 floors.
Oreto and Brancaccio: 2 to 5 storey houses and 1960s blocks, a lot of yards and sheds along the railway (Brin: `ind` 0.74).

### ZEN (San Filippo Neri), CEP, Borgo Nuovo
ZEN is the quartiere San Filippo Neri (ZEN 1 and ZEN 2), so one zone. No usable Commons photo was found for ZEN. **(est.)** from general
knowledge and the OSM footprints (large rectangular slabs): 4 to 7 storey prefab concrete insulae, long horizontal window ribbons, exterior
stairwells, graffiti and shuttered ground floors, faded pastel paint over grey concrete, flat roofs, grime 0.8. CEP / Borgo Nuovo:
`Santa Rosa da Lima (Palermo) 13 11 2023 01.jpg` (CC0) shows a boxy grey concrete church beside a pale orange 5-storey block: 3 to 7
storeys, mix of slabs, blocks and palazzine, grime 0.65.

### Tommaso Natale, Sferracavallo
Photos: `Lungomare di Sferracavallo 01.jpg` (CC BY-SA 4.0), `Sferracavallo - Panorama aereo.jpg` (PD), `Barcarello 1.jpg`. The main road is lined with
3 to 5 storey salmon, pink and cream blocks; the aerial view shows dense whitewashed and cream houses with flat roofs and a few 7-storey
blocks near the harbour; the fishing quarter around Via Barcarello is 1 to 3 storeys with painted doors and blue shutters (`fish`, ground
floors `fis_door` / `fis_win`). Tommaso Natale: 2 to 5 storey palazzine and houses, **(est.)**.

### Mondello, Valdesi, the lido
Photos: `Mondello 03.jpg` (a cream-yellow Liberty villa with a blue-trimmed gable, curved arched door, palms), `Mondello Beach in Spring.jpg`,
`Golfo di Mondello - Palermo.jpg`, `Mondello BW 2012-10-09 13-23-41.JPG` (the tower). Cream, butter and pale pink villas and summer
houses, 2 to 3 floors, deep-eaved tile roofs (roof multiplier 1.4 to 1.5), Liberty villas; Valdesi is the villa quarter behind the bay.
The lido strip is `fish`/`low` with white and teal timber cabins, striped cabana fronts (`bch_a`, `bch_b`) and timber deck roofs. The Charleston
pavilion itself is a landmark (not here).

### Arenella, Acquasanta, Vergine Maria
Photos: `Villa igiea.jpg` / `Villa Igiea Palermo lato nord.jpg` (CC BY-SA 3.0: crenellated tufa-ochre hotel, `#b0864f`, in a palm garden).
The villages: 1 to 4 storey houses, whitewash and pastel plaster, small harbours (`fish` 0.24 to 0.5), a few Liberty villas, heavy sea
salt grime. **(est.)** for the houses.

### Port and Brin
Photos: `Cantieri navali palermo.jpg` (CC BY 3.0: cranes, sheds under Monte Pellegrino), `Porto e bacini palermo dall'alto.JPG` (CC BY-SA 3.0:
grey-beige warehouse roofs, dense cream and pink 5 to 7 storey blocks behind the quays). Large footprints become `ind` (corrugated sheet
or prefab panels, roller doors, metal roofs); round footprints in these zones become `silo` (pale slip-formed concrete). Brin: 1 to 3 storey sheds.

### Uditore, Passo di Rigano, Sampolo / Fiera
Photo: `Via leonardo da vinci.jpg` (CC BY 3.0). 3 to 6 storey 1980s palazzine (`pal`: one balcony per bay, glazed or solid parapets, light render
in cream and pale ochre, lower grime) beside 1960s blocks; Fiera / Sampolo is 4 to 8 storey blocks plus large exhibition sheds. **(est.)**

### La Favorita
Photos: `Palazzina cinese 0001.JPG` (CC BY-SA 3.0). Country villas and farm buildings of the Bourbon park: 1 to 3 storeys, ochre and pink plaster,
red tile roofs (multiplier 1.6), no shops. **(est.)**

## Pass 2: checked against Street View (details in docs/faithfulness/buildings.md)

- **New zones.** `avenue` (tall condo avenues, street rule 18 m: Strasburgo, Notarbartolo, Viale Lazio, Campania, Francia, Regione Siciliana, Leonardo da Vinci),
  `calat` (old radial corsi, street rule 20 m: Calatafimi, Tukory, Pisani), `cruillas` (village core with blocks around it, replaces one `cep` seed). The street rules for
  Principe di Paterno, Duca della Verdura, Sciuti, Villabianca and Empedocle Restivo stay `sacco`.
- **Set-back fronts.** `buildings.js` gives the elig zones `reach` (`Z.front`, default 15 m): a wall with no street within 3.2 m still counts as a front if a street edge
  lies within `reach` m along its normal with no building in between. This is what puts shops and balconies on Via Liberta's set-back blocks and on housing estates.
- **Lidar-calibrated storeys.** `flA` on periph, rural and tn (see `tools/district-calibrate.mjs`), `insArea` on zen (insulae from 110 m2), dense pockets take the
  `BLOCK_FL` table, buildings under 40 m2 get a storey count too in calibrated zones. `applyDistrictHeights` stores the zone (`b.dz`) next to `b.dh`; `buildings.js` uses
  that choice unless a street rule moved the zone.
- **Styles.** `pw` takes the zone palette in the new zones and is rare in the postwar belts; `pal` uses balcony columns on every other bay and half of its buildings get
  the new `rail_g` (anodised aluminium and tinted glass); `ins` ground floors are pilotis and garage doors.
- **Palettes.** Pale cream, off-white and grey-beige in the Liberta belt, the grid, the avenues, Resuttana, Fiera and Arenella; sand-ochre ZEN; yellow Noce; terracotta-orange
  and cream Brancaccio; tufa stone Acquasanta.
- **Debug.** `?bdbg` fills `window.__bldDbg` (per building zone, style, height source) and `window.__bldTris` (triangles per style).

## What is not done

- The Favorita, Politeama proper, Valdesi, Fiera and Corso dei Mille were not checked against Street View in pass 2 (no usable capture at the points tried).
- The Liberty style uses one palette family and a handful of tiles; the great set pieces (Villino Florio, Villa Igiea, Villa Malfitano,
  Villino Basile, Grand Hotel et des Palmes) are landmarks and belong in `landmarks-city.js`, not here.
- Beach clubs on stilts, boats and nets are not modelled; the lido is cabins and decks only.
- Roller-shutter boxes, AC units and laundry are painted into the tiles, not modelled.
- Photo facades (`assets/facades/photo/map.json`) still load for the centro only.

## Checking it

- `docs/districts/compare.jpg`: reference photo beside the render for Via Notarbartolo, Corso dei Mille, Sferracavallo and Mondello.
- `docs/districts/m1.jpg` (Via Liberta, sacco grid, ZEN), `m3` (Kalsa, Albergheria, Borgo Vecchio, Noce), `m4` (Corso dei Mille, Oreto,
  Stazione, Zisa), `m5` (CEP, Tommaso Natale, Mondello), `m6` (Sferracavallo, lido, Arenella, Acquasanta), `m7` (port, Brin, Uditore, Fiera),
  `m8` (Favorita, Valdesi, Politeama): free-camera renders from `tools/district-shot.sh` (viewer lighting, no props or traffic).
- `window.__bld` / `console` print per-style counts for the centro build; `tools/district-view.html` prints them per tile set.
- Triangle budget: about the same as before (9 tiles around Via Liberta 491k before, 524k now; 9 tiles in the centro 866k before, 861k now).
  The atlas grew by 30 layers of 256 x 256 (about 10 MB of texture with mips).
