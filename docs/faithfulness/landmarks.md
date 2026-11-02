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

## City gates (src/lmc-gates.js, Porta Nuova model in src/landmarks.js, Mondello gate in src/lmc-c.js)

Checked against the it.wikipedia list of the Renaissance gates (Mura di Palermo), Commons categories "City gates in Palermo" and each gate's own category, and the OSM extract. Photos in /private/tmp/claude-501/palermo-gates/refs/ (not in the repo).

| gate | what it really is | done |
| --- | --- | --- |
| Porta Nuova | rusticated limestone arch 5.8 m wide under a two-storey tower, four Moors beside the arch, loggia, majolica pyramid | drivable arch; model re-centred on its 18 x 18 m OSM footprint, pale stone, Moors; passage kept open by `PORTA_NUOVA` (see collision) |
| Porta dei Greci | round arch (about 5.6 m wide, 6.4 m high) through a plastered 19 m block with red and green pointed windows and a group of pointed lights, flanked by wings | rebuilt over the whole OSM strip w49683271, drivable |
| Porta Sant'Agata | rough Norman wall with a pointed arch (3.6 m wide) at the foot of the Piazza Porta Sant'Agata | new wall and arch, drivable; position from Commons geotags and Wikidata, no OSM object (a few metres of error) |
| Porta Carini | NOT an arch: two baroque pylons with urns facing across Via Porta Carini (OSM has both as small footprints) | two pylon models, street open |
| Porta Felice | two pylons, no lintel (lmc-d.js) | unchanged |
| Porta di Vicari (S. Antonino), Porta Reale | corner pylons of ordinary blocks, no arch | not modelled |
| Porta Mazzara, Porta Montalto | ruined wall with a pointed arch inside a fenced courtyard, not a street | skipped |
| Porta dei Leoni (Favorita), Ingresso monumentale di via Roma | two stone pylons with lions; two curved palazzi without an arch | skipped |
| "Porta Garibaldi" | does not exist in Palermo (Catania, Milan, Marsala have one); Garibaldi's Mille attacked the demolished Porta Termini | nothing to build |

Collision: world.js lets a landmark carry `dropWalls` (building ids whose footprint walls are not registered) and `walls` ([x0,z0,x1,z1] segments). The gates use that, nothing in main.js, world.js or the bake changed. Porta Nuova: footprint dropped, two pier rectangles (18 m deep, 6.1 m each side of the 5.8 m passage). Porta dei Greci: the 29-vertex palace ring is dropped and its outline re-registered with the passage cut out (the ring is clipped by the passage corridor on both sides, so the passage walls and the wings stay). Porta Sant'Agata has no footprint, so only its two pier rectangles exist. Checked by driving the lapa at each gate from 25 m away at several lateral offsets: it goes through between about -2 and +2 m of the centreline and stops at the piers and wings (/private/tmp/claude-501/palermo-gates/pier.mjs).

OSM issues: Porta Nuova's footprint (w815701117) covers the street and its estimated height is 11.2 m against a real 30 m or more; Porta dei Greci is part of the whole Palazzo Forcella De Seta footprint (one ring, 29 vertices, with the OSM `tunnel=building_passage` road crossing it and vertices exactly at the tunnel ends); Porta Sant'Agata has no building or wall object; Porta Carini's pylons are tiny buildings with estimated heights (10.3 and 13.5 m, modelled at 13 m each).

## Charleston gate, Mondello (lmc-c.js `buildMondelloGate`)

The two entrance towers stood in a line along the direction the gate faces (22 m apart east-west, one in front of the other on a shore that runs north-south), the colonnade ran the same way and its lintels were turned a quarter turn. Now (Commons: Mondello BW 2012-10-09 14-18-56, the 1957 postcard, Antico Stabilimento Balneare di Mondello): the gate faces along the boardwalk to the pavilion, the towers stand side by side across it 22 m apart, the colonnade bows towards the sea between them (ends 3.8 m back, ends meeting the towers' land side), two slender columns each side, a taller pylon with a ball finial on each side of the middle opening and a low curved pediment between them. The position (-3043, -9598) is unchanged. The pavilion front is turned about 22 degrees from that line (it follows the OSM pier footprint), so the boardwalk meets it slightly off square.

Cost (triangles per instance): Porta dei Greci 788, Porta Sant'Agata 256, each Carini pylon 544, Mondello gate 724 (it was about the same), Porta Nuova about 900 more than before (the eight Moors, roughly 3.6k in all). Test scripts and the before/after/reference sheets are in /private/tmp/claude-501/palermo-gates/ (`shots/cmp_*.jpg`).

## The centro landmarks read the streamed ground (board item x6)

The ten centro models in `src/landmarks.js` (Quattro Canti, Fontana Pretoria, Palazzo delle Aquile, Teatro Massimo, Cattedrale, Porta Nuova, Porta Felice, San Cataldo, Santa Caterina, Palazzo dei Normanni) used to be built once at start-up, when `groundY` still answered from the old baked centro grid. They are now `CENTRO_LANDMARKS` (name, x, z, radius, build), built by `src/world.js` like the city landmarks: once the tile they stand on has terrain, and the tiles their footprint reaches into have too (or are not coming; after 8 s it builds anyway). The group is kept as the part `lm:<name>` of that tile, so it survives the tile's detail changes (the distant skyline keeps its landmarks) and is built again after the tile was released. `main.js` no longer builds them; `prepareLandmarks` still marks the generic buildings they replace. `?nolm=1` still skips them. Build time on the dev machine: 1 to 32 ms each (Quattro Canti the longest), 87 ms for all.

Height of the old baked grid against the streamed tiles at the model's anchor (m, baked minus streamed): Normanni +9.2 (the tower stood 9 m too high), Porta Nuova +6.0 (hence the 35.5 constant, now removed: the base is `groundY` at the passage), Cattedrale +1.2, Santa Caterina -1.1, Pretoria -1.8, the rest within 0.5.

Footing: every model's lowest vertices against the streamed ground under them (`groundcheck.mjs`, median / 5th / 95th percentile, m): Quattro Canti +0.1 / -0.3 / +0.5, Pretoria +0.0 / -0.4 / +0.7 (was +1.2: the lidar reads the basin itself as ground, so the base is now the level of the piazza 12 m round it and a skirt hangs from the fence ring), Porta Felice base is the lowest ground under the 11 x 10.6 m pylon box and a skirt hangs round it (the +1.0 the check reports there is the two fountain basins, which stand 0.9 m up on their stems), Teatro -0.2, Cattedrale 0.0, Porta Nuova -0.1, Aquile -1.4, San Cataldo -1.0, Santa Caterina -1.9, Normanni -0.7. Negative is buried on the high side of a slope, which is fine; nothing floats more than the basins and plinths that are meant to stand off the ground.

## Quattro Canti rebuilt (board item c10)

References: Wikimedia Commons, "Palermo-Quattro-Canti-bjs2007-01.jpg" (CC0, front view of one facade), "Quattro Canti, Palermo, Sicily, Italy (9455477141).jpg" (Flickr, CC BY 2.0, two facades from the piazza); viewed for proportions only, nothing of them is stored. Real facade as read from them: a rusticated panelled pedestal, three tiers between two grey marble monolithic columns each (Doric, Ionic, composite pilasters), a deep curved balcony on corbels with an iron railing between the first two tiers, in the lowest tier a three-stage fountain (lower basin with a garland, upper basin, the season in marble) and a white inscription cartouche, in the middle tier a dark shell-headed niche with the Spanish king and green-shuttered windows with pediments and angels, in the top tier the patron saint's niche with an angel on a cloud over it, small windows in white stucco frames, an attic with end volutes and shields and the royal arms (eagle and crowned shield) on top, two black three-arm candelabra in front of the side bays, honey-coloured weathered limestone, white statues and stucco, green shutters.
Model (`paintQC`, `buildQuattroCanti`): the four concave arcs are found as before; each facade is a faceted concave wall painted on one 768 x 1536 texture (blocks that get finer with height, the panelled pedestal, quoin strips, stucco window frames with shutters, cornice shadows, metope band, attic panels, streaks and a darkened foot) with the heavy parts as geometry: arc slabs for the pedestal and the three entablatures with modillions, the corbelled balcony, six columns with their capitals, the garlanded fountain with water, the season and the king and the saint on pedestals in shell-headed niches, window pediments with angels, the crown with arms, two lamps, and a skirt where the ground falls away. About 7,100 triangles a facade, 28,400 for the four (17,400 before). One texture of 768 x 1536 (was 512 x 1024), about +3.6 MB of GPU memory with mips. The statues are the toolkit's robed figure: the seasons, kings and saints are not individually modelled.
