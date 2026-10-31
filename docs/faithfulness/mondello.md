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
