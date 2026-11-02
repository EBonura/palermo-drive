# Street furniture from public open data (board item d2, after the Mapillary stop)

Mapillary was ruled out (`docs/sources/mapillary.md`). This note is the search of the Comune di Palermo and Regione Siciliana open data portals for lamps, poles, signs, benches, bins,
hydrants, crossings and trees as points. Checked on 2 November 2026.

## Result: one usable dataset, monumental trees. No street furniture exists on either portal.

### Comune di Palermo, https://opendata.comune.palermo.it
The machine-readable catalogue (`https://opendata.comune.palermo.it/dcat/dcat.php`, 1,610 datasets) was searched by title, description and keyword for: illuminazione, lampioni, punti luce, panchine,
cestini, idranti, arredo urbano, alberi, alberature, semafori, segnaletica, strisce pedonali, attraversamenti, cassonetti, stalli, ciclabili, georeferenziati, kml. Nothing is a street-furniture
point layer. What the terms matched, and why none is used:

- **Rifiuti, contenitori per la raccolta (datasets 38, 284):** four rows of city-wide totals (7,804 bins and 12,171 m3 in 2010). No positions.
- **Zone blu, stalli (1050):** parking stalls counted per zone P1 to P9 and year. No positions.
- **Itinerari ciclabili (852, 1719):** a table of cycle routes by street name with lengths. No geometry.
- **Numeri civici georeferenziati (1782) and stradario (1781):** address points (ANNCSU), not furniture.
- **Fontanelle AMAP (1249):** drinking fountains, already in the game (`docs/sources/transit.md`).
- **AMAT GTFS (bus stops):** already in the game.
- Tourism points of interest (308, 901), police accident and infraction records (375, 520, 523), asbestos checks and waste-abandonment sites are not furniture.

### Regione Siciliana, https://dati.regione.sicilia.it (CKAN, 192 datasets)
Package search for illuminazione, lampioni, arredo, idranti, alberi, cassonetti, segnaletica, panchine, attraversamenti and semafori: only **Alberi Monumentali di Sicilia** matches.
No lighting, furniture, bins, hydrants, signs or crossings.

### SITR Carta Tecnica Regionale 1:10,000 (already used for walls and trees, `docs/sources/ctr-sicilia.md`)
The point-symbol layers 1 to 4 were counted by class over the whole service: kilometre stones, small bridges, lighthouses; wayside crosses and shrines, towers, electric cabins, monuments, church
crosses and bell towers; tanks, wells, springs, pools; pylons, line supports, telecom antennas. No street lamps, benches, bins, hydrants, signs or crossings. Not used for this item.

## Monumental trees (used)

- Dataset: "Alberi Monumentali di Sicilia", Regione Siciliana, list under L. 10/2013 and the decree of 23 October 2014, updated 5 May 2021. Portal licence: `cc-by` (Creative Commons Attribution,
  the CKAN licence record gives no version). Compatible with the other CC BY sources. GeoJSON from
  `https://dati.regione.sicilia.it/dataset/e97e6962-69db-4de8-b321-1795dd4e0b58/resource/05ae82f3-077a-4e9f-9430-099692cec8f0/download/alberi-monumentali-sicilia.geojson`
  (115 KB), saved as the git-ignored `data/monumental_trees.geojson` (`tools/monumental.py fetch()` downloads it again).
- 159 features in Sicily, 58 in the province of Palermo, 46 in the Comune of Palermo, 42 after dropping four groups ("Insieme omogeneo di ...": one point for a whole stand or avenue, such as the palms of
  Villa Giulia and Villa Bonanno).
- Fields kept: position (decimal degrees from the GeoJSON geometry, converted with the project's `bake.py` constants), scientific name (decides the model: `Ficus` and the palms by name, `Olea` as
  olive, conifers as pine, `Dracaena`, `Nolina` and `Yucca` as the palm-like `tall`), height. The trunk circumference is not used.
- **Game value, not data:** the crown radius is not in the dataset. `r = clamp(0.35 x height, 3, 9)` m (broadleaves other than Ficus are held to 4.2 m so props.js does not draw them as ficus).
  The in-game scale is r / 2.7 and at most 2.4 times the base model, so the Villa Garibaldi ficus (36 m trunk circumference, 21 m high) is drawn about 2.4 times the size of a normal ficus.
- **Dedup:** the bake drops the generic tree items (OSM, CTR, lidar, Urban Atlas lattice) within max(4 m, 0.7 r) of each monumental tree and adds the monumental one: 43 generic trees replaced by
  42. Almost every monumental tree already had a generic tree on it; the change is the species, the height and the crown. The positions are survey GIS points, a few metres off at worst.
- Baked into `props.items` of 20 tiles by `tools/tiles.py` (after the greenery step). No runtime change: `src/props.js` already scales a tree by `r` and picks the model from `ge`, `sp` and `kd`.
- Credit: `Regione Siciliana, Alberi Monumentali di Sicilia (open data, 2021), CC BY` (README and the manifest credits).

## Still missing (no open source found)
Street lamps, benches, bins, hydrants, signs and crossings beyond what OSM maps. OSM is the only source; `docs/TILES.md` and `tools/tiles.py` already take every `highway=street_lamp`, `amenity=bench`,
`amenity=waste_basket`, `emergency=fire_hydrant` and `highway=crossing` node. Closing the gap would need an asset register from whoever maintains them, obtained by a data request. Who holds those registers was not checked, and asking is a decision for the owner.
