# Mondello round: the game against Mapillary photos, again

Date: 2 November 2026. Nothing here is copied from a photo: the photos (Mapillary, CC BY-SA, and a few Wikimedia Commons files) were only looked at and live outside the repo in `/private/tmp/claude-501/mondello/` (`ref/` the photos, `shots/` the game, `sheets/` the contact sheets, `hero/` and `cs2/` the before and after sets).

## What was compared

- 90 Mapillary photos across Mondello, picked from every image in a box around the bay (6,291 images, 5,811 not panoramas): the piazza (7), the Torre della Tonnara (5), the quay and harbour (7), four stretches of Viale Regina Elena (5 each), the Charleston (9), Hotel La Torre and the road up to it (8), the watchtower side (5), Valdesi (9), the stretch toward Valdesi (4), the streets behind the front (16). 23 more were picked as photos that look at one landmark (Charleston 8, the tower 6, the harbour front 5, the hotel 4).
- The game was put at each photo's position and heading, 1.6 m up, with `tools/faith_shoot.mjs` (60 degrees vertical for the survey sheets, 80 for the before and after sets, because the photos are wide angle). Contact sheets from `tools/faith_sheet.py`, 8 pairs each. The tools used are the Round 2 ones plus three small scripts that are not in the repo (the search of a box, the pick of photos that look at a point, the before and after sheet).
- Caveats. Photo positions are phone or action camera GPS, good to a few metres, and four photos stand inside a building outline in the game (pz_03 to pz_06 sit in the thin OSM ring of the harbour front, so the game frame is inside a roof). The compass heading of the 2018 photos is not reliable: qy_15, qy_16, ch_35 and cs_2 do not point where the game camera points (the big cliff in qy_15 and qy_16 is a mountain across the water that the game frame does not look at), so those pairs say nothing. Several photos were taken in the afternoon with the sun behind the mountain, the game is 11:00.

## The Valdesi tower

I could not confirm a tower at Valdesi, and I did not make one up.

- OpenStreetMap (Overpass, a box 38.175 to 38.22 N, 13.30 to 13.345 E, every `man_made` tower, `historic` tower, castle, fort, ruins, `building=tower` and anything with Torre, Tower or Valdesi in the name): the neighbourhood node Valdesi (38.19617, 13.33095), Piazza Valdesi (roads, a park), a bus stop, a cafe, a post office, a climbing spot at 38.19203, 13.33782, and no tower at Valdesi. The towers it does find: Via Torre di Mondello and a bus stop Torre Mondello (the tonnara tower, 38.2063, 13.3253), the hotel's watchtower (`w285428887`, 38.21198, 13.33001), `il Semaforo` (`w285427913`, 38.21774, 13.31088) and Torre Amari (ruins, 38.21768, 13.30293) at Capo Gallo.
- Wikidata, everything with coordinates within 3.2 km of Valdesi: three towers and no tower at Valdesi. Torre della Tonnara di Mondello (Q113555961, 38.207179, 13.326199), Torre del Fico d'India (Q110310359, 38.211953, 13.329969) and a second item Torre di Mondello (Q113555964, 38.21199, 13.330146) for what looks like the same watchtower, and Torre dell'Addaura (Q113555960, 38.189685, 13.342040, a coastal tower, type Q1293150).
- Wikipedia (English and Italian geosearch, 3 km): no tower article near Valdesi. Wikimedia Commons (geosearch 1.8 km, text search for Valdesi and Mondello): the only Valdesi hit is "Chiesa Maria SS. Assunta a Mondello-Valdesi.jpg" (CC BY-SA 4.0, a church on Via Mater Dei, built in the early twentieth century).
- What I can say. (1) That church is OSM `w87015606` (Maria Santissima Assunta, Wikidata Q119907236, 38.1953, 13.3309); in the Commons photograph it has a slim square bell tower behind the facade. If "the Valdesi tower" means the campanile, there is no height or footprint for it in OSM, so I did not build it. (2) The Torre dell'Addaura is a whitewashed round tower with a crenellated crown in a private garden on the Addaura slope, 1.2 km south-east of Valdesi along the coast; its only coordinate is Wikidata's, OSM has nothing there, and three Mapillary photos about 140 m away (ad_0 to ad_2) show no tower, only a gate, so the place is not confirmed and I did not model it. (3) The towers of the bay proper are the tonnara tower (fixed below) and the hotel's watchtower (already modelled, position agrees with OSM and Wikidata). Ask the owner which one was meant.

## Ranked: what a Palermitan would notice first

| rank | item | what the photos show against the game | status |
| --- | --- | --- | --- |
| 1 | Monte Gallo and Monte Pellegrino behind the bay (every sf, bk, ch sheet) | grey-brown limestone with dark scrub and sheer grey faces; the game has a smooth pale straw ramp with small palms standing in rows on the face (bk1_77, bk2_80 to bk2_82, sf2_24 to sf2_28). Heights belong to the terrain work, the rock and cover colours are in `src/world.js` and the tile tint | not touched (terrain and `world/` owner) |
| 2 | Torre della Tonnara in the wrong place | in all five photos that look at it (towercheck, tq_0 to tq_4) the round tan tower stands at the corner of the harbour front where the quay road begins, at about 38.20718 N 13.32620 E (game -3070, -10109.5); the game had it 90 m away at the OSM building `w73411068`, which is a 7 m square building, so the harbour front had no tower and a tower stood at the end of a side street | fixed |
| 3 | The harbour front houses | the real front is mostly white and cream blocks, one pale yellow, one ochre, with cafe terraces: white umbrellas, planters, tables on the pavement; the game had orange and salmon plaster, arcades, no terraces (tq_0 to tq_4, hq_3) | palette and terraces fixed; balconies and shop signs still generic |
| 4 | The Charleston | cream-peach plaster, an arcade of maroon doors, tall arched maroon windows, pink roundels, white cornice; the game was a mustard yellow barracks with dark slots (cs_0, ch_36, ch_37 photos) | colour and painted front fixed; turret crowns and the curved gable still simpler than the real ones |
| 5 | Trees along the roads | the game's umbrella pines and palms are huge low-poly lumps standing in lines; the real roads have mixed pine, palm, scrub and hedge (sf and bk sheets) | not touched, trees have their own work |
| 6 | Pavements | the game has 3 to 4 m of light grey slabs along the carriageway; the real kerb is narrow with dry verge or hedge (sf2_24 to sf3_42, bk2_80) | not touched, generic streets |
| 7 | Road up to Hotel La Torre | real lane has a tall iron railing on a stone plinth and pines (ht_61 to ht_64, wt_69 to wt_73); the game has clipped green hedge walls and plain ochre walls | not touched (fences, generic) |
| 8 | Street lamps and bollards | real lamps are blue, thin, a curved top with two bell lanterns; real bollards are black with a yellow band (qy_12 to qy_14, hq_0 to hq_2); the game's lamps are blue T-posts, its bollards plain grey. At game distance the lantern is two or three pixels, so changing the lamp would show no difference; the bollard is a shared prop used all over the city | not changed |
| 9 | Valdesi horizon | a pale grey disc with a soft edge on the left horizon in va_50 to va_55, probably the far low-detail mountain; I am not sure what it is | not investigated |
| 10 | Colour of the plaster behind the front | ochre and orange in the villa streets where the photos show white and cream (ht_64, ht_65, sf4_43); this is the district palette | not touched (generic facades) |

Already close: Viale Regina Elena as a two-lane road with the right turns and the zebra crossings, the seafront lamps in blue, the hotel (white block with blue balcony bands at the right place on the promontory, hw_0 to hw_2), the hotel's round watchtower position, the beach width, the colonnade gate.

## What was changed

All in `src/lmc-mondello.js` and `src/lmc-c.js` (both files are entirely this round's, no one else has edits in them).

1. `src/lmc-mondello.js`: `TOWER_Q = [-3070, -10109.5]` and the tower in `buildHarbour` now stands there; the comment says where the position comes from. `MN_HARBOUR.skipIds` is empty now, so the OSM 7 m building `w73411068` is drawn again where it really stands. In `buildQuayRow` the house fronts and rooftop rooms within 7.5 m of the tower are left out (the tower stands in that corner of the outline), the random draws still happen so the other houses keep their colours.
2. `src/lmc-mondello.js`: `PLASTER` is whiter (white, cream, pale yellow, one ochre, one pale pink, no orange).
3. `src/lmc-mondello.js`, `buildQuayRow`: on the street side of the row within 95 m of the tower (outward normal towards the road), a white umbrella, a table and a pot of oleander in front of each house front.
4. `src/lmc-c.js`, `buildStabilimento`: plaster colours from mustard yellow to cream-peach, and two painted fronts (`mnFront` 512 x 160 on the first two storeys, `mnTop` 256 x 64 on the upper central block): an arcade of maroon doors, a blue and white dado, tall arched maroon windows with white frames, pink roundels, a white cornice. The helper `arcW` paints an arch with a frame.

## Pictures (before, after, photo; absolute paths)

- Tower, plaster and terraces, same camera as the photos tq_0, tq_1, tq_2 and tq_4: `/private/tmp/claude-501/mondello/hero/tower2.jpg`
- Charleston from the boardwalk, before, after, photo cs_0: `/private/tmp/claude-501/mondello/cs2/stab_ba.jpg`
- Aerial check of the corner and terraces: `/private/tmp/claude-501/mondello/ov/ov.jpg`
- The 90 survey pairs as they were before the fixes: `/private/tmp/claude-501/mondello/sheets/sheet-01.jpg` to `sheet-12.jpg` (index in `index.txt`), the photos-of-a-landmark sets in `sheet-cstqhqhw-01.jpg` to `-03.jpg`.

## Cost

Triangles measured in the running page after the change: harbour front 3,968 (the notes say about 2,000 before, so about 1,900 added, from about 15 terraces of about 125 triangles), Antico Stabilimento 2,298 (two quads added), harbour and tower 10,260 (the tower is the same size, moved). Textures: two small canvases, about 0.4 MB. No new draw calls except two materials in the Stabilimento group. I did not measure frame time and did not run on a phone; the added geometry only exists inside the landmark radius (90 to 100 m).

## Not tested

Driving into the new tower (the OSM outline walls are still the collision, and the tower overlaps them by a metre or two), the night look of the Charleston front, the phone, the hotel watchtower from a photo (no photo shows it), the harbour marina (the photos of the pontoon have unreliable headings), the cabins behind the Charleston (the real beach in front of it looks free of cabins in the 2018 and 2022 photos, but the photo positions do not settle it).
