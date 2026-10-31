# Landmarks outside the centro: faithfulness notes

Owner: city landmarks work (src/landmarks-city.js, landmarks-city-data*.js, lmc-kit.js, lmc-a..d.js).
Method: real references (Wikimedia Commons, Wikipedia, Google Maps satellite for looking only, never copied into the repo), then the same viewpoint in the real game with headless Chrome, list differences, fix, re-shoot.
Reference and game screenshots live in /private/tmp/claude-501/lm (not in the repo).

## Stadio Renzo Barbera (priority, rebuilt)

Compared: Google Maps satellite (oblique), Commons photos (aerial plan, Via del Fante street front, interior, curve exterior), the seating plan, OSM footprint (outer ring 215 x 149 m, playing-area ring 144 x 78 m, long axis SSE).
What the real stadium is: an elongated oval with straight sides and round ends, two tiers split by a rose-coloured walkway, teal-green and blue plastic seats, ONE roofed stand (the Tribuna on the west-south-west long side, a deep pale cantilever roof with a teal fascia and white pylons), the other long side and both ends open to the sky, pale concrete outside with a pylon per bay, a blue-teal window band and a teal eave, tall white floodlight masts at the corners, a metal fence with sponsor boards round the plaza.
What was wrong before: teal canopies on BOTH long sides, saturated green seats, grey facade with a roman-amphitheatre look, no roof over the real main stand, no fence, the red running track hidden by the tile's raised ground layer (the pitch mesh was 3 cm above it; now 0.8 m above the terrain with polygon offset, the red track stays as requested).
Now: 120-sample bowl from the OSM rings, lower tier to ~9 m, rose walkway, upper tier to ~21 m, radial gangways, concrete facade (pylons, windows, teal band), teal eave ring, Tribuna roof (top pale, underside dark grey, tall teal back fascia, pylons), fence 13 m out with sponsor boards, four 52 m masts, vehicle gate through the north end kept (physics walls unchanged), 7.8k triangles.
Before/after (same six viewpoints): /private/tmp/claude-501/lm/stad/before/b1..b6.png and /private/tmp/claude-501/lm/stad/after/b1..b6.png.
Not done: the diagonal stair ramps on the exterior, the roofs of the curved ends (stepped teal bays), car-park markings (ground layers belong to the land cover work).

## Audit of the 22 existing models

| model | compared with | change |
| --- | --- | --- |
| Castello Utveggio | Commons photos (3 views) | sits on a grey limestone crag (new `crag` primitive) instead of a brown box; left tower lowered, tall right tower; grey base wall |
| Santuario di Santa Rosalia | Commons (facade, square, cliff) | pale limestone sheer cliff behind, ochre/cream with white trims and green shutters, grey cliff footing. The OSM footprint is only the church end; the long convent is the neighbouring generic building |
| Zisa | Commons front, entrance | front repainted: seven bays of pointed blind arches over two storeys with windows, three portals at the foot (middle one the tall iwan); before it had three giant arches |
| Ponte dell'Ammiraglio | Commons (5 views) | nine pointed arches of unequal span scaled to the OSM way (was eleven), smooth sloped parapets (were steps), round tower at each end |
| Palazzina Cinese | Commons (6 views) | walls orange-ochre with red bands (was brick red); lavender-grey arched basement, round portico and gate pillars were already right |
| Gymnasium, Orto Botanico | Commons | orange-ochre sandstone and column colours (portico, red inner wall, sphinxes already there) |
| Villino Florio | Commons | grey-brown stone and slate, not ochre |
| Villino Ida | Commons | white plaster with green shutters, not ochre |
| Villa Igiea | Commons | deeper sand-ochre |
| Stadio | see above | rebuilt |
| Mondello (stabilimento, gate, beach) | in game, 2 views | checked in the real game on the real coast: reads correctly (Liberty pavilion on piles, two towers, wings, boardwalk, gate towers); no change |
| Politeama | Commons (6 views) | proportions and quadriga match; unchanged |
| Cuba, Eremiti, Normanni front, Villa Giulia gate, Teatro Garibaldi, Ucciardone, Fiera gate, Stazione Marittima | game views, Commons where found | not changed this pass (see "known gaps") |

Known gaps: Stazione Marittima in photos is a low warm-coloured arcaded station, ours is a tall pale block; Cuba and Eremiti want a closer pass (Commons category for the Cuba only returned interior shots); Palazzo dei Normanni front is a plain repeated bay; Fiera gate has no signage.

## New places (src/lmc-d.js, footprints in landmarks-city-data2.js, all from the OSM footprints in world/tiles)

Coordinates verified against Wikipedia or the local OSM extract (data/city/pbf_*.json.gz):
- Palazzo di Giustizia, Piazza Vittorio Emanuele Orlando, 38.1186 N 13.3519 E (it.wikipedia) matches OSM relation r1241799 (-806, -330). Rationalist travertine block, 1938 to 1957. ~1.1k tris.
- Albergo delle Povere, OSM r1225257 (-1382, 633), baroque poorhouse, weathered ochre, portal, arcaded courtyards (three largest).
- Villa Niscemi, OSM r3398039 (-2354, -5420), cream baroque villa, balconies, palms.
- Villa Castelnuovo (-2314, -4742) and the Teatro di Verdura entrance pavilion on Viale del Fante (it.wikipedia: pronaos with two telamones under a pediment, gate flanked by two sphinxes; the pavilion footprint is OSM w243098992 at (-2362, -4953), about 160 m from the villa, the page coordinates 38.1606 N 13.3342 E agree within 15 m). The cavea itself (a horseshoe in the garden) is not modelled, its shape is not in OSM.
- Castello di Maredolce (Favara palace), Wikipedia 38.0923 N 13.3875 E, OSM w44835616 (2288, 2587): blocky sandstone with blind pointed arches, crenellations, round corner tower.
- Tonnara Florio (Arenella), OSM w278476938 / w278804155 and the mill tower w1291036899: tuff sheds with pointed-arch bays, tiled roofs.
- Porta Felice outside (OSM r6309453 two pylons at (870, -446) and (881, -426)): baroque ochre pylons with painted pilasters, doorway, niche, balcony, broken pediment.
- Convento dei Cappuccini and its church (OSM r10316797, w747164879): plaster convent round the cloister, church with a pedimented portico. The catacomb entrance is inside the convent and is not visible from the street.
Not added (no verifiable footprint or no reference in the time): Villa Trabia (OSM only has a 10 x 7 m lodge tagged with the name), Ospedale Civico main block, Mondello pier and Torre di Mondello, Sferracavallo harbour, Ponte Corleone, port cranes (no crane, quay or terminal object exists in the OSM extract, so there is nothing to anchor them to), Monte Pellegrino Scala Vecchia walls.

## Engineering notes
- `crag()` in lmc-kit.js: jittered frustum for cliff footings.
- Models place everything relative to `groundRange` of the footprint; new models use `front(key)` (box axis facing the nearest road) and repeating facade textures with v aligned to the base (`body()` in lmc-d.js).
- Landmark `skipIds` hide only the generic mesh; collision walls of the generic footprints stay (so models stay inside their footprints).
- Seen in the logs, not mine: `src/sea.js` ring shader uses the reserved word `patch` as a variable name (GLSL error "Illegal use of reserved word" at line ~163 of the fragment shader, appears in strict-validation Chrome runs).
