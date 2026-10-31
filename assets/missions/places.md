# Places used by the missions (coordinates from OpenStreetMap, via Nominatim, queried at 1 request per second)

Destinations: Antica Focacceria San Francesco (Via Alessandro Paternostro 58, Kalsa), Nino u Ballerino (Corso Calatafimi, Porta Nuova; the other OSM node, Corso Finocchiaro Aprile 76, is about 80 m outside the drivable box),
Ke Palle (Via Maqueda 270), Nni Franco u Vastiddaru (Piazza Marina 2), Mercato di Ballarò (Piazza del Carmine), Mercato del Capo (Via Porta Carini), Piazza Garraffello (Vucciria).
Stigghiulari: Piazza del Carmine (Ballarò), Mercato del Capo, Piazza Magione (Kalsa, stand-in: "Piazza della Kalsa" is about 40 m outside the box), Piazza Garraffello (Vucciria).
Pickups: the seven landmark spots from main.js. Everything is in `lines.js` (DESTS, PICKUPS, VENDORS) with the outside-the-box places in LATER.
- **Taverna Azzurra** (destination, suggested by Hubert): 38.1176395, 13.3634460, Discesa Maccheronai 9, Vucciria. Source: Nominatim/OSM (bar).

## Night places (all from OpenStreetMap; Nominatim at 1 request per second with a User-Agent, Overpass for lookouts and parking)
- **Piazza Sant'Anna** (Kalsa, packed with young people after dark): 38.1149181, 13.3651434. Also Piazza Garraffello 38.1179401, 13.3649292 and Taverna Azzurra 38.1176395, 13.363446 (Vucciria), Ballarò 38.1113556, 13.3615778, Il Capo 38.1186189, 13.3540701.
- **"u spacciaturi" zones** (position-based): Ballarò, Vucciria 38.1181915, 13.3652235, Il Capo, Zisa (Castello della Zisa) 38.1167741, 13.3410551, Noce (Piazza Noce) 38.1219451, 13.3329544. The last two are outside the centro map: they work with ?world=1.
- **A Favorita** (needs ?world=1): Viale Diana, 38.148519, 13.346399, snapped onto the road centreline of world tile -3_-8 (Nominatim said 38.1485191, 13.3463992). Parco della Favorita itself: 38.1597110, 13.3399734.
- **Pollanche**: Santuario di Santa Rosalia 38.1680111, 13.351843 (Via Monte Erta); the carts are set beside the service road at 38.16809, 13.351714 and by the hairpin at 38.166878, 13.349531.
- **Appartati** lookouts and lay-bys (Overpass tourism=viewpoint / amenity=parking, each snapped to the nearest world-tile road and set on the verge): Palermo view 38.15222, 13.36083; Via Padre Giordano Cascini 38.17551, 13.36133; Via Santuario hairpin 38.16687, 13.34892; Favorita parking 38.15044, 13.34258 and 38.15134, 13.33967; Piazzale dei Matrimoni 38.15138, 13.34794. Pizzo Vuletta and Piano Zotta are real viewpoints too but have no road in the baked tiles (273 and 331 m away), so they are left out.
