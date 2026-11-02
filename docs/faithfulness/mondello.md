# Mondello, Valdesi and Partanna-Mondello: faithfulness notes

Owner feedback was "Mondello is not close, by a mile". References were looked at only (never copied into the repo or the game): Wikimedia Commons
(Category:Mondello with 79 files, plus its sub-categories Alle Terrazze 27, Harbour of Mondello 6, Torre della tonnara 12, Capo Gallo 7, Hotel La Torre 3, Addaura 3;
about 135 views, many of them the same places), Google Maps satellite (6 views: the bay, Alle Terrazze, Valdesi, the borgo) and Street View (Via Terza Compagnia,
Viale Regina Elena). Mapillary and Flickr were not opened directly (Flickr photos came in through Commons; Commons rate limits cut the later categories short).
In-game shots were taken with headless Chrome at the same spots; before/after screenshots are in `/private/tmp/claude-501/mondello/` (`b/` before, `final/` after,
Google imagery is not in the repo). Local x,z: Piazza Mondello (-3060,-10150), harbour quay (-3052,-10084) to (-2933,-10147), Torre (-3126,-10038), Stabilimento (-2987,-9603),
Valdesi (-2560,-8930), Partanna promontory (-2800,-10450).

## Differences found and what was done

| Place / view | Real (photo, satellite, Street View) | Game before | Fix |
| --- | --- | --- | --- |
| Villa quarter ground (aerials from Pellegrino, satellite) | roofs sit in dark green canopy: lawns, hedges, pines, palms, citrus; paving only along the carriageway, on the promenade and in the piazza | every yard within 24 m of a house was a pale slab floor (baked `raised` layer), a few palms | `src/gardens.js`: the raised material gets a world-space mask (white = keep paving, 3 m off roads, 14 m off the back of the beach, piazzas) and a lawn texture elsewhere; `src/props.js` section 12d scatters pines, palms, ficus, citrus, shrubs in the gardens |
| Lido cabins (drone photo, Commons) | back-to-back rows of narrow wooden cabins, vertical stripes in one colour and white (red, blue, pink, green, yellow, teal), louvred door, shallow roof, rows run from the promenade towards the water | none, only umbrellas and a few kiosks | `src/lmc-mondello.js` `MN_CABINS`: about 200 cabins per beach stretch, four stretches (north of the Stabilimento, centre, two towards Valdesi), 6 striped materials |
| Seafront lamps (all promenade photos) | slender cobalt-blue steel posts with a double arm, every 25 m | generic grey poles | `MN_LAMPS` along the back of the beach from the harbour to Valdesi, plus the quay front |
| Torre di Mondello (tonnara tower photos) | round sandy-tan rubble tower about 13 m high, crown of merlons, one slit window, door at the foot, next to the beach end and the harbour | a 7 m flat box | `MN_HARBOUR`: cylinder 8.6 m across, corbelled crown with 12 merlons, slit, door; replaces `w73411068` |
| Fishing harbour (Commons harbour category, borgo photos) | wooden gozzi: white hulls, red line, blue or yellow strakes, hauled out on the slipway and moored stern-to along the quay; concrete pontile with railing | empty water, piers only | about 40 hulls (three slices with a sheer line, raised stem, some with a wheelhouse), the pontile, pots with oleander on the quay |
| Antico Stabilimento (Commons Alle Terrazze, 27 views) | cream-yellow Liberty pavilion on piles: central block with a pediment and three turret towers with crowns, finials and lightning rods; on the sides a long gallery of maroon and cream striped cabin fronts under a balustrade, a big plain two-storey block at the north end and a small box at the south end; long boardwalk to the colonnade gate | pavilion with two pyramid-capped towers, flat striped fascia on low sheds | `src/lmc-c.js` `buildStabilimento`: pediment block, three crowned towers with finials, striped galleries, north block with window rows |
| Beach sand and rock | almost white, fine sand; Monte Gallo and Pellegrino pale grey-ochre limestone | pale tan sand, brown-grey rock | beach tint `#e4dbc2` and lighter sand texture in `src/world.js` and `src/streets.js`, lighter rock colours |
| Plaster colours (piazza photos, Street View) | butter yellow, cream, pale pink, white; little grime | dull tan, grime 0.22 | `src/districts.js`: lighter, creamier `mondello` and `valdesi` palettes, grime 0.12 |
| Distant villa quarter (aerials) | green canopy | grey-brown carpet at low detail | `src/world.js`: inside the garden region the low-detail terrain tints olive green instead of urban grey |
| Piazza Mondello | paved, pots, blue posts | paved slabs (kept by the mask), few details | posts and pots on the quay front |

## Already close (checked, not changed)

Shoreline and curve of the bay (OSM coast), turquoise shallows fading to deep blue, Viale Regina Elena as a two-lane road with a promenade, the umbrellas and sunbeds,
Monte Pellegrino and Monte Gallo as masses framing the bay, the colonnade gate, palms along the seafront, Partanna promontory with the Hotel La Torre block.

## Not done (needs other owners or more data)

- Monte Gallo is a 300 m vertical limestone wall right behind the borgo; the terrain grid gives a smooth ramp (about 35 degrees). Terrain heights near the mountains belong to the terrain agent.
- Ground at Piazza Mondello is 7 to 13 m above sea level in the grid, the real piazza is at the waterline with the cliff behind it. Same cause.
- The 138 x 121 m polygon behind the quay (`w73411051`) is one OSM outline for a block of red-roofed buildings and yards; `chooseStyle` now gives such outlines in these zones the plain `res` style, but it still reads as one big block (it was still teal-striped in the last shot, possibly a cached facade).
- Hotel La Torre footprint (`w73395786`, 54 points, a ring of wings) is still the generic building; the real one is a white block with blue balcony bands and a stone watchtower on the rock.
- Beach width: the OSM sand polygon is 25 to 50 m, the real dry beach is wider in the middle of the bay (satellite: 50 to 80 m).
- The Valdesi tower and the rocky headland at the south end, and the Addaura road under the cliffs towards Palermo, were not modelled specifically.
- No Mapillary views; Street View covered only three spots (one failed to load).


## Leftovers fixed (board item c5)

References, proportions only, nothing stored: Wikimedia Commons "Mondello BW 2012-10-09 13-59-24" (CC BY-SA 3.0, the harbour front), "Hotel la torre - panoramio" (CC BY-SA 3.0, the hotel and its tower), "Il golfo di Mondello" (CC BY-SA 2.0, the width of the beach), "Palermo addaura", "Addaura - panoramio (1)" (the Addaura coast), "Torre di Addaura".

| item | finding (photo and OSM) | fix |
| --- | --- | --- |
| The block behind the quay (`w73411051`) | not a solid 138 x 121 m block: the outline is a ring of attached houses about 10 m deep, h 6.2 m in OSM. The photographs show a harbour front of three- and four-storey houses, each its own colour (cream, pink, yellow, white, ochre), arched shop fronts on the quay, tall shuttered windows with small balconies, flat roofs with little rooftop rooms | `src/lmc-mondello.js` `MN_QUAY`: the ring is cut into houses of about 9 m along every outer edge, each with its own plaster colour and the painted front (shop arch, shuttered balcony window, attic window, string course, cornice), 9.4 m high, a rooftop room on four in ten; the footprint walls stay as collision. About 2,000 triangles |
| Hotel La Torre (`w73395786`) | a long white block of four storeys with continuous blue balcony fronts and a glazed ground floor, standing on a rock terrace on the promontory | `MN_HOTEL`: the 54-point ring as a white four-storey block (13 m) with the painted blue balconies and sliding doors, a plant room on the roof, a rock footing from the lowest ground up to the terrace (the old model was a tan block); about 1,600 triangles with the tower |
| The watchtower (OSM `w285428887`, a 22-point round building 8 m across, 75 m past the hotel) | a round grey rubble tower with a broken crown on the rock at the end of the promontory | in `MN_HOTEL`: 9.8 m tapering rubble tower, corbelled crown with 3 of 14 merlons gone, a door a storey up, two slits |
| Beach width | in the game the dry beach (the OSM sand polygon's back edge to the coastline) was 24 to 64 m, 40 m on average; the photographs and satellite views show 50 to 80 m in the middle of the bay | `tiles.py` `widen_beach`: where the shore is nearer than 58 m to the back of the sand the coast is pushed seaward by the difference (26 m at most, smoothed, 8,300 m2 of new sand in all, nothing in the Stabilimento's stretch z -9690 to -9510). The strip is land, sand layer and tint; the near grids of the four tiles (-7_-20, -6_-20, -6_-19; -7_-19 unchanged) and the manifest's land ring were patched in place. Widths now 47 to 61 m where it was widened (51, 52, 47, 61, 48 m at z -9950, -9850, -9750, -9450, -9350). The cabins and umbrellas follow the waterline |
| The Valdesi tower | no tower was found for Valdesi: OSM has no tower, historic or named tower feature there, and the Commons search found none (the only towers in the area are the Torre di Mondello, already modelled, the hotel's watchtower, now modelled, and the Torre di Addaura, whose location could not be established from OSM or Commons) | not modelled: nothing in the sources to build it from |
| The Addaura road | the road is OSM's Lungomare Cristoforo Colombo / Viale Regina Elena, a two-lane road with pavement and walls, between the sea (a rock breakwater and bathing beaches, per the photographs) and the cliffs of Monte Pellegrino. In the game it is there with the pavement, the walls and parked cars (checked from four chase-camera positions) | no change: the road follows OSM, and the photographs show no feature (tunnel, gallery) that the game lacks |

Collision: the footprint walls of the three buildings still stand (the models replace the drawing, not the walls); drive test, 9 m/s at six segments of each ring from outside: the lapa stops at the wall (1.5 m) every time.
