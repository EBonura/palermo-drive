# Faithfulness survey, round 4: the game against Mapillary photos, a fourth time

Date: 4 November 2026. Game commit shot: c96e15d (a `git archive` snapshot of HEAD, served on its own port, so other people's edits did not change the round). Reviewer: one pass, no fixes made. Nothing here is copied from a photo; the photos were only looked at and live outside the repo.

The question this round answers: the photo-textured walls are gone and the old-town facades, the seven named palaces, blank walls, guard rails, direction signs and road paint have been reworked since round 3 (3c00ae2). Which visual gaps would make the biggest visible difference next?

## What was compared

- **Same set as round 3, nothing skipped.** 138 pairs at the survey viewpoints that have a Mapillary photo (game camera at the photo's own position and heading, 1.6 m up, 60 degrees vertical fov, 11:00, UI hidden, car hidden, 1024 by 768), 17 pairs at the extra places (xqc, xtm, xpo, xmo, xpr, xsd, xvu, xcp, xsc, xsr, xba, xfa), and 25 game-only views (Cattedrale, Normanni, Porta Nuova and Teatro Massimo stand-off shots, Vucciria and ZEN in four headings, three extra headings at the Foro Italico). That is 180 shots, all of them looked at, and the counts are comparable with round 3.
- **The photos were reused from round 3** (`ref/` and `meta/` linked, nothing copied or downloaded; `tools/mapillary_refs.py` and `tools/mapillary_extra.py` were not run). Same camera, time and size, and the same 4.5 s of settle after the world reported itself calm (`tools/faith_shoot.mjs --settle 4500`, Chrome with `--mute-audio`, through the shared browser slots). 180 of 180 shot on the first pass, none flagged unsettled, no page errors, and a per-image variance check found only ce18 flat (the camera faces a wall close up, as in round 3).
- **Extra shots, reported separately so the 180 stay comparable.** 21 game-only frames: the seven redrawn walls (Riso, Gangi, Borsa, Biondo, Palmes, Jung, Malfitano) at stand-off distance plus seven closer or oblique reframes where the first frame was blocked (hb_*), Piazza Pretoria from four sides (hpr_S, hpr_E, hpr_N, hpr_W), and three direction-sign frames on the motorways east of the city and on the A29 (hs_gantry1, hs_porto, hs_a29). Nine more frames come from a second snapshot of the commit just before the photo walls were removed (9ff4a1a^), at the same camera spots, to judge what the photo removal cost. That snapshot was deleted after use.
- Image reads: 26 survey sheets (6 pairs each, game left, photo right), 5 game-only sheets, 10 three-way composites (round 3 | round 4 | photo) for the rows that might have moved, 7 sheets of the extra shots and 3 before/after sheets: 51 reads. The sheets are 384 by 288 per picture, so small detail (a sign, a fence type, sign lettering) is weak evidence; I say so where it matters. A pixel difference between the round 3 and round 4 shot of each id (mean change and share of pixels changed by more than 40 grey levels) was used to find what moved: 23 of the 180 shots changed in more than a fifth of their pixels, nearly all of them because of trees (new palms, bare planes), plus su34 (new buildings in the lane) and the two Normanni frames (a tree in the lens).
- What changed in the game since round 3 and was looked at on purpose: old-town facades (moulded window surrounds, bracketed sills, pediments, slatted shutters, rusticated ground floors, plaster that does not repeat), the seven walls redrawn by hand after the photo walls were removed, blank walls and plinths without the repeating brown marks, steel guard rails along motorways and Viale Regione Siciliana, green direction signs and gantries from OSM destinations, solid edge lines and hatched gores, and, between these, a fresh map bake and a tree pass (real species shapes, bare planes, fuller palms) and post-war blocks with more variety.

Caveats, the same as round 3. Photos are 0.1 to 12 years old; I did not count roadworks hoardings (po11, ce37, pt07, pt04) as defects. A phone compass heading is not always right. Where the game camera ended up inside a wall or an alley (ce18, mo09, su01, po24) the pair is can't tell. Walking sprites sometimes stand in front of the lens, and a crashed car lies on its side in po23 (a game event, not a defect). The mission beam (a pink or blue vertical line, and a pink ribbon on the road at lm06) shows in some frames (hca_S, hca_W, xtm_1, htm_F, po22, pt15, lm06, xqc_2, zi18); it is a game overlay, not a defect. The panorama pairs (mo06, mo07, mo18, mo21, mo22, su09, su37) are crops of an equirectangular picture and are stretched. Statuses are from one person looking at thumbnails once; borderline calls between fixed and partly fixed could go either way. The seven redrawn buildings have no Mapillary photo in the set, so they are judged against what I know of the buildings and against the Wikimedia pictures the drawings were made from, not against a pair.

## Counts

Old high findings in `round-2.md` (147 rows), each checked against the new shot:

| status | round 2 | round 3 | round 4 |
|---|---|---|---|
| fixed | 36 | 46 | 46 |
| partly fixed | 30 | 43 | 54 |
| still there | 69 | 46 | 35 |
| can't tell (no usable view, temporary object, camera in a wall) | 12 | 12 | 12 |

Note the round 2 column was judged against the round 1 findings, round 3 against the round 2 table and round 4 against the round 3 table, so a few rows moved by reading the photo differently rather than by a game change. This time I re-judged every row against both the round 4 shot and the round 3 shot of the same id, and the only moves are the 11 below.

All 11 moves are the same one: **still there to partly fixed, the motorway-grade roads** (po25, mo25, zi15, zi17, su09, su10, lm19, lm20, lm21, lm22, lm23). Nothing moved to fixed and nothing moved down. The facade and wall work did not move a single row, because the old findings are about whole faces that the new facade style does not reach (ce22, ce16, ce15, ce09 are pixel-near-identical to round 3 on the big flat faces; the new style shows on the named palaces and on streets that already had it). That is the main result of this round: the polish went into places a survey photo rarely stands in front of, and the big blank faces that photos do show are where the gap is now.

What improved, from what I saw:

- **Fast roads look like fast roads.** Steel guard rails with posts along the edge and solid white edge lines (I saw no hatched gore in any frame): po25, mo25 (left side), zi15, zi17, su09 (median), su10, lm19 to lm23. Green gantry and roadside signs exist and look right in the frames made for them (hs_gantry1, hs_porto, hs_a29) and show on the horizon at su10. The rails are thin and pale grey, but the road no longer reads as an ordinary street.
- **Bare winter trees where the photo has them.** su13, zi08 and zi09 now have bare, pollarded planes with spiked tops instead of green plates; this matches the photos of Via Basile and Viale Michelangelo much better than round 3 did. Palms have fan crowns (pt01 to pt05, pt19, mo02, yp_0 to yp_2) instead of umbrella plates, and the Foro Italico reads as a palm seafront.
- **The named palaces are good.** Gangi (hb_gangi), Riso (hb_riso), Jung (hb_jung), Villa Malfitano (hb_malf_a, hb_malf_b) and Borsa (hb_borsa) read as the buildings they are: colour, proportions, rusticated arcade, shutters, frieze and portal in the right places. Before the photo removal two of them (Jung, Malfitano) showed broken panels hovering in the air or a blank slab; those are gone.
- **Window surrounds, shutters and rusticated ground floors show up where a facade has them.** The right side of ce09, po01, ce10, ce34 (a long arcaded front), pt11 (fruit shop and awning), pt26, xpo_0 and xpo_1 (Politeama) and the hero buildings. Post-war blocks vary now (two different blocks side by side at po23, frames and balconies at po18, po12, su11, zi20).
- Round 3's fixed rows stayed fixed. Piazza Pretoria in the game (hpr_*) has the right surroundings: Palazzo delle Aquile with its clock turret (hpr_N) and the Santa Caterina dome (hpr_W).

## Old high findings, one by one

Round 3's table, same rows, with a round 4 column. The old finding text is shortened from round 2.

| id | layer | old finding (shortened) | round 3 | round 4 |
|---|---|---|---|---|
| ce01 | landmarks | Quattro Canti is unrecognisable at the viewpoint: real view is the open octagon with two huge b... | fixed | fixed (xqc_0 to xqc_2 show the concave fronts, fountain and niches, but flat: no carved stone or statues like the photo; ce01 itself is under a cafe awning) |
| ce01_p | landmarks | At the crossing itself the game still shows no octagon: a blank buff wall with a red awning at... | can't tell | can't tell (photo spot is under a cafe awning) |
| ce02 | landmarks | Same as ce01. | fixed | fixed |
| ce04 | pavements | Real street is an asphalt road with a white edge line and dashed lane marks, narrow stone pavem... | fixed | fixed |
| ce05 | pavements | Real: asphalt road with dashed centre line and stone kerbs, pedestrians walking in the road; ga... | fixed | fixed |
| ce09 | pavements | Real street is a 9 m asphalt road with a white centre line, shop terraces and pedestrians; game... | still there | still there (slabs across the whole piazza, no asphalt street or centre line) |
| ce09_p | pavements | The game ground here is a tan terrain-tint plain instead of an asphalt road with a centre line,... | still there | still there |
| ce10 | landmarks | Game cathedral side is a flat buff wall with pointed lancet windows and a battlement; the real... | fixed | fixed |
| ce10_p | landmarks | Cathedral is present with the right overall layout (battlemented wall, a square tower at the le... | fixed | fixed |
| ce12 | vegetation | Real roadside has stone pines, bare planes and a palm; game has lime lawn with spruce cones and... | partly fixed | partly fixed (bigger low-poly crowns, no stone pines or bare planes) |
| ce12 | walls, gardens, fences | The long bastion wall of the palace on the right (grey-ochre, 8 m high, sloping base) is missin... | fixed | fixed |
| ce12_p | walls, gardens, fences | The 8 m high palace bastion wall along the right of the road is absent; the game shows open law... | fixed | fixed |
| ce12_p | vegetation | Spruce cones at the horizon instead of stone pines, bare planes and a palm. | partly fixed | partly fixed (umbrella crowns, not stone pines) |
| ce15 | vegetation | Real left side is a tall dressed-stone retaining wall under big ficus and holm oak; game has a... | partly fixed | partly fixed (big crowned tree in front of the slab, no ficus over a stone wall) |
| ce15 | walls, gardens, fences | The retaining wall is replaced by building massing; the upper palazzo set back behind the wall... | still there | still there (still a plain slab, no retaining wall) |
| ce16 | facade style and colou | Real lane is an old-town alley: arched wooden doors, wrought-iron balcony canopies, cream and o... | partly fixed | partly fixed (arched door, canopies and a fruit shop on the right; the left is a blank red wall with a floating cream panel) |
| ce18 | facade style and colou | Real alley is a 4 m canyon of weathered terracotta and ochre plaster with a dark painted skirt,... | can't tell | can't tell (camera inside a wall) |
| ce22 | facade style and colou | Real street walls are 5 storey baroque palazzi with deep wrought-iron balconies on carved stone... | partly fixed | partly fixed (unchanged: balconies on the right, the left face is still one flat terracotta slab) |
| ce27 | pavements | Real street is asphalt with a white edge line, a stone kerb and terracotta planters; game paves... | fixed | fixed (road and kerb right; no planters or cafe tables) |
| ce32 | pavements | Game has a big tan sand patch on the left of the carriageway and a long skid rectangle; real ha... | fixed | fixed |
| ce32 | street furniture, prop | Real street is full of moving and parked cars and shop awnings with stalls at the kerb; game ha... | partly fixed | partly fixed (parked cars, no stalls or awnings at the kerb) |
| po01 | street furniture, prop | Real street has cars parked on both kerbs, bikes, dustbins and a yellow edge line; game has an... | partly fixed | partly fixed (shutters and balconies on both sides now, cars on one side only) |
| po02 | vegetation | Real avenue is a continuous canopy of plane and jacaranda trees along both sides of Via Ruggero... | fixed | fixed |
| po08 | walls, gardens, fences | Real left side is a tall dark-green iron railing on a stone plinth along a garden, with leaves... | still there | still there (camera still sits in a hedge box, no iron railing on a plinth) |
| po11 | pavements | Real right side is a continuous construction hoarding with concrete barriers and billboards; ga... | can't tell | can't tell (roadworks hoarding) |
| po12 | road layout, width, ma | Real road is a narrow one-way service lane (about 6 m) with parked cars along the kerb, running... | partly fixed | partly fixed (post-war blocks look right; road still wide, no jersey barrier) |
| po18 | street furniture, prop | Real street is lined with cars on both kerbs, motorbikes and a speed-limit sign; game has a yel... | partly fixed | partly fixed (cars on one kerb, photo has both) |
| po19 | street furniture, prop | Real has parked cars along both sides in a continuous row, an ESSO station with a red canopy an... | partly fixed | partly fixed (rows of cars; no petrol station) |
| po22 | street furniture, prop | Real street has an iron-railed tram median with overhead wires, queued cars, and a hedge and tr... | fixed | fixed |
| po23 | street furniture, prop | Real left side is a black iron railing on a concrete plinth guarding the tram line, with overhe... | fixed | fixed |
| po24 | street furniture, prop | Real has an Osteria sign, an Italian flag on the palazzo, shop fronts at street level, scooters... | can't tell | can't tell (camera against a shopfront) |
| po25 | road layout, width, ma | Real road is a motorway-grade carriageway with double steel guard rails on both sides, a hatche... | still there | partly fixed (steel guard rail with posts on the left and solid edge lines now; no gantry, no hatching) |
| po27 | vegetation | Real left is a median planted with large ficus and broadleaf trees, right side has parked cars... | partly fixed | partly fixed (big canopy trees, no median) |
| po27 | street furniture, prop | Cars parked bumper to bumper on the right kerb, a cafe terrace with awning: missing. | can't tell | can't tell (a plain plaster wall still hides the shops) |
| po31 | vegetation | Real avenue has big plane trees overhanging both kerbs, a palm and a stone-pine row; game has b... | fixed | fixed |
| po31 | street furniture, prop | Cars parked on the right kerb with blue-line bays, traffic lights on mast arms, a road sign: mi... | partly fixed | partly fixed |
| po34 | walls, gardens, fences | Real right side is a 5 m transparent and black noise barrier on a raised ramp with a guard rail... | still there | still there (no noise barrier) |
| mo01 | walls, gardens, fences | Real left side is a continuous plastered garden wall with villas, palms and parked cars behind... | partly fixed | partly fixed |
| mo02 | walls, gardens, fences | Real left is a white plastered wall with a gate, tropical shrubs over it and parked cars; game... | fixed | fixed |
| mo05 | walls, gardens, fences | Real right side is a dense tall hedge and tree wall behind a kerb, left side has parked SUVs al... | partly fixed | partly fixed (wall and trees on the right, no hedge, no parked SUVs on the left) |
| mo06 | walls, gardens, fences | Real street is a 6 m lane between plaster garden walls and hedges under mature stone pines and... | can't tell | can't tell |
| mo09 | vegetation | Game fills the roadside with a grove of fat, 15 m tall palm trunks with spiky crowns; real road... | can't tell | can't tell |
| mo09 | walls, gardens, fences | Real left side is a rubble stone retaining wall topped with an iron fence and a villa garden; g... | can't tell | can't tell |
| mo12 | pavements | Real road runs straight between garden walls and hedges with trees overhead, asphalt to the ker... | fixed | fixed |
| mo12 | walls, gardens, fences | Garden walls, plaster fences, tree canopy and a parked car row missing. | partly fixed | partly fixed |
| mo18 | walls, gardens, fences | Real lane is hemmed by a rubble wall topped with a diamond mesh fence on the right and a villa... | can't tell | can't tell |
| mo20 | walls, gardens, fences | Real right side is villa gardens with a brick or stone wall, gates and cypress; game has a pale... | partly fixed | partly fixed |
| mo23 | walls, gardens, fences | Real right side is a tall stone gate pier with iron gate and a long wall; left has a plaster vi... | partly fixed | partly fixed (a tall plain wall where the photo has a gate pier and a villa wall) |
| mo25 | road layout, width, ma | Real road at this point is a motorway-grade ramp towards the A19/A20 with steel crash barriers... | still there | partly fixed (steel rail on the left and solid edge lines now; the tall plain wall on the right and the missing gantry sign remain) |
| mo26 | vegetation | A single huge spruce cone stands beside the road; real roadside is broadleaf trees, olive and b... | partly fixed | partly fixed (tall plain wall at the road) |
| pe06 | walls, gardens, fences | Real road has a continuous 0.8 m dry-stone parapet on the valley side and a rock cut with grass... | fixed | fixed |
| pe06 | vegetation | Real slope is dry grass tufts, shrubs and a few Aleppo pines; game has 20 m tall spruce cones a... | partly fixed | partly fixed (umbrella pines, the slope is still a smooth wedge) |
| pe08 | terrain | Real hairpin runs under an overhanging ochre limestone cliff with rock outcrops and a grassy ve... | still there | still there (still a huge pale slab) |
| pe13 | walls, gardens, fences | Real left side is hedge-covered garden walls with iron gates and villas; game has a wide pale p... | partly fixed | partly fixed |
| pe14 | walls, gardens, fences | Real left is a plaster and brick wall with a decorative iron gate, bougainvillea and oleander a... | fixed | fixed |
| pe14 | pavements | The pale paved slope at the foot of the cliff replaces the real rock face with scrub. | fixed | fixed |
| pe15 | walls, gardens, fences | Real right side is a tall rubble stone retaining wall with a mesh fence; sea side has a steel c... | still there | still there (bare sand slope, no rubble wall) |
| pe16 | walls, gardens, fences | Real right side is a white stone-clad garden wall topped by a clipped hedge and trees; game has... | fixed | fixed |
| pe19 | walls, gardens, fences | Real lane is 4 to 5 m between an oleander hedge with grass verge (left) and a retaining wall wi... | still there | still there |
| pe19 | vegetation | Oleander in flower and Aleppo pine umbrellas missing. | still there | still there |
| pe21 | walls, gardens, fences | Real right side is a continuous 3 m masonry wall (long, stuccoed) with cypress behind; game has... | fixed | fixed |
| pe21 | street furniture, prop | Cars parked bumper to bumper on both kerbs; game has none. | still there | still there (no parked cars) |
| pe22 | walls, gardens, fences | Same long tall wall and plane trees in the real photo; game shows sand bands, a pale pavement a... | fixed | fixed |
| pe23 | walls, gardens, fences | Real right side is a 3 m ashlar stone wall with oleander and cypress behind, left has plaster w... | fixed | fixed |
| pe29 | street furniture, prop | Real street has cars parked along both kerbs, nose to tail; game has two dumpsters and an empty... | fixed | fixed |
| pe31 | terrain | Real street frames the grey limestone wall of Monte Pellegrino at the end of the street; game v... | fixed | fixed (cliff has bands, but the face looks corrugated) |
| pe31 | walls, gardens, fences | Real right side is a low stone wall with a mesh fence and a reed thicket; left has fences and g... | partly fixed | partly fixed |
| pe32 | vegetation | Real avenue is a tunnel of mature broadleaf oaks and poplars with dry grass and orchard trees b... | partly fixed | partly fixed (fuller crowns, still plates on identical trunks, not oak and poplar) |
| zi05 | street furniture, prop | Real avenue has a tram line behind a black iron railing with red overhead-wire poles, tram stop... | fixed | fixed |
| zi07 | street furniture, prop | Real central reservation carries a tram line with red overhead poles, a black iron railing, and... | fixed | fixed |
| zi08 | vegetation | Real avenue has a double row of mature plane trees on both sides and a hedge strip; game has no... | fixed | fixed (bare winter planes now, as in the photo) |
| zi09 | vegetation | Real roadside has plane trees, a stone pine and a palm; game has bare sand and tan paving. | fixed | fixed (bare planes now) |
| zi09 | pavements | Game road sits on a 10 to 15 m wide tan band and blank pale apron; real asphalt runs straight t... | fixed | fixed |
| zi15 | road layout, width, ma | Real is a 3 lane motorway-grade carriageway with continuous steel guard rails, solid white edge... | still there | partly fixed (steel rail on the right edge and solid edge lines now; no left rail, no gantry) |
| zi16 | road layout, width, ma | Real is a 3 lane carriageway with solid edge lines, steel guard rails both sides, tufted scrub... | partly fixed | partly fixed (unchanged from round 3: a rail and bollards on the right only) |
| zi17 | road layout, width, ma | Real is a curving expressway ramp with a guard rail, grass verge, a big stone pine and heavy tr... | still there | partly fixed (rail beside the pavement; photo has a grass verge and a rail in front of the pines) |
| zi18 | pavements | Real road is a 3 lane carriageway with a concrete retaining wall and railings on the right and... | partly fixed | partly fixed (cracked yard, no carriageway or marks) |
| zi18 | road layout, width, ma | The tram viaduct wall and guard rail are absent. | still there | still there (no viaduct wall or rail) |
| zi19 | street furniture, prop | Real central reservation carries a tram line with red overhead-wire poles, iron railings and si... | fixed | fixed |
| zi20 | street furniture, prop | Real street is packed with cars parked double-deep on both sides, shop awnings and a tabacchi s... | still there | still there (no double parking) |
| zi21 | street furniture, prop | Real left side is a tram line with iron fence and red poles; right has a white noise barrier on... | partly fixed | partly fixed (poles and rail, road itself missing) |
| zi21 | vegetation | Giant ficus canopy over the road is missing. | still there | still there (bare sand plain) |
| zi28 | walls, gardens, fences | Real lane runs between iron-railed walls and a green mesh fence with a stone-and-concrete gate... | fixed | fixed |
| zi28 | vegetation | Eucalyptus avenue and shrubs missing. | partly fixed | partly fixed |
| zi28 | building heights and m | Real road has fenced gardens and villas on both sides; game has empty ground (missing buildings... | still there | still there (empty ground) |
| zi31 | street furniture, prop | Real street has cars parked bumper to bumper on both kerbs; game has none. | partly fixed | partly fixed (unchanged: shutters, no parked cars) |
| zi33 | walls, gardens, fences | Real right side is a 3 m precast concrete wall with a rusty spiked fence on top, left is a scru... | fixed | fixed |
| su01 | street furniture, prop | Real street is a busy shopping street with parked scooters, cars both sides and shop signs in r... | can't tell | can't tell |
| su02 | building heights and m | Real junction is a busy street with market stalls under white awnings, 5 to 8 storey blocks on... | still there | still there |
| su04 | street furniture, prop | Real central reservation has a tram line with red overhead poles and decorative iron railings,... | still there | still there (a faceted green ball still fills the lens, no tram) |
| su05 | street furniture, prop | Cars parked along both kerbs, shop awnings and a person at the kerb; game has none, only an emp... | partly fixed | partly fixed (the long blank wall now has a faint plaster texture instead of marks, still no cars, awnings or people at the kerb) |
| su06 | street furniture, prop | Real street has cars parked on both kerbs, a dumpster, shop shutters and laundry hung on balcon... | partly fixed | partly fixed |
| su07 | street furniture, prop | Real roadside has an IP petrol station with canopy and price sign, billboards and arching lamp... | still there | still there (no petrol station, billboards or arching lamps) |
| su08 | vegetation | Real road runs under a continuous tunnel of stone pines (umbrella crowns, 15 m) next to a steel... | still there | still there (one lone umbrella tree) |
| su09 | vegetation | Real road has a long row of stone pines and palms on a planted median with a steel guard rail a... | still there | still there |
| su09 | road layout, width, ma | Median with guard rail and lamp posts missing; game has a flat single carriageway. | still there | partly fixed (median guard rail, lamp posts and a pavement now; no planted median of pines) |
| su10 | road layout, width, ma | Real is a raised expressway with double steel guard rails, mesh fence and tall twin-arm lamps n... | still there | partly fixed (guard rails both sides, solid edge line and a green gantry sign on the horizon; scrub and tall twin lamps missing) |
| su11 | street furniture, prop | Real street has cars parked nose to tail on both kerbs and a central strip with shrubs; game ha... | partly fixed | partly fixed |
| su12 | street furniture, prop | Real side street has cars parked along both kerbs and graffiti-covered wheelie bins; game has o... | fixed | fixed |
| su13 | vegetation | Real avenue has a long row of pollarded plane trees on both kerbs; game has none. | fixed | fixed (bare pollarded planes now, as in the photo) |
| su16 | pavements | Real junction is clean asphalt with kerbs and recycling bins; game has a tan terrain plain with... | partly fixed | partly fixed |
| su17 | walls, gardens, fences | Real lane runs beside a 2 m concrete wall with a plaque, reeds, stone pines and cypresses; game... | still there | still there |
| su17 | vegetation | Reeds, pines and cypress missing. | still there | still there |
| su17 | pavements | Game has 20 m of pale paving beside a 6 m road; real is a lane with a walled edge. | still there | still there (the grey slab still floats across the lane) |
| su18 | vegetation | Real street is an avenue of broadleaf trees with a canopy over the road and recycling bins; gam... | fixed | fixed |
| su18 | building heights and m | Real street is enclosed by houses and walls; game has open ground. | still there | still there |
| su19 | walls, gardens, fences | Real lane is a 3.5 m strip between a whitewashed rubble wall (left) and a dry-stone terrace wal... | partly fixed | partly fixed |
| su19 | terrain | Real mountain is a steep grey limestone face with green scrub terraces; game slope is a smooth... | fixed | fixed |
| su24 | building heights and m | Real junction is a rural village edge with 1 to 2 storey houses behind rubble and plaster walls... | still there | still there (floating buff panels hang in the air) |
| su24 | walls, gardens, fences | Whitewashed and rubble garden walls, an iron gate and road signs missing. | still there | still there |
| su26 | road layout, width, ma | Real is a landscaped roundabout with kerbed island, shrubs, give-way and roundabout signs, a lo... | still there | still there |
| su26 | building heights and m | Real horizon has a fenced industrial yard, tank, and a railway embankment with overhead wires;... | can't tell | can't tell |
| su29 | road layout, width, ma | Real is an elevated viaduct with concrete parapet, lamp posts and trucks; game is a road across... | partly fixed | partly fixed (brown underside slab, no road deck or parapet) |
| su34 | walls, gardens, fences | Real lane is hemmed by a 4 m rough ashlar wall on the right with weeds and a plastered farmhous... | partly fixed | partly fixed (windows, doors and a pitted lane now; no 4 m ashlar wall) |
| su38 | walls, gardens, fences | Real lane has 2 m plastered garden walls with gates and a row of parked cars under trees; game... | fixed | fixed |
| su39 | walls, gardens, fences | Real left side is a long rubble stone wall with a wrought-iron fence and a stone pine; game has... | partly fixed | partly fixed |
| su41 | walls, gardens, fences | Real left side is a 2 m orange works hoarding and a wall with an iron gate; right has cars park... | partly fixed | partly fixed |
| su43 | street furniture, prop | Real street has cars on both kerbs, a stepped brick pavement and balcony plants; game has an un... | still there | still there (long front with window rows as before; no cars, stepped pavement or plants) |
| su44 | walls, gardens, fences | Real road runs between a ruined ashlar farmhouse wall (right) and a guard rail with dense Medit... | still there | still there |
| su44 | building heights and m | Real tall rough-cut stone ruin and tree canopy missing; confirms the south coast plain finding. | still there | still there |
| su45 | vegetation | Real roadside has eucalyptus, birches and bamboo; game has bare ochre ground with sparse traffi... | still there | still there |
| pt01 | vegetation | Real seafront has tall Washingtonia and Phoenix palms and big clipped pittosporum hedges; game... | fixed | fixed |
| pt02 | landmarks | Real view ends at a neoclassical colonnaded gateway with a lion-topped pediment (Porta dei Grec... | can't tell | can't tell |
| pt03 | vegetation | Date palms in groups, shrubs and a stand of pines are replaced by spruce cones and ball trees. | fixed | fixed |
| pt03 | pavements | Game road sits on 15 m sand bands left and right; real road has a kerb and pavement with a stal... | fixed | fixed |
| pt04 | vegetation | Real left has a fence with orange netting (works) and tall Washingtonia palms plus a stone balu... | fixed | fixed |
| pt04 | coastline and sea | No balustrade or sea wall in the game; the real right side has a stone balustrade with posts. | partly fixed | partly fixed (unchanged: a small pale crag behind the trees in yp_0, hidden by crowns at pt01; no skyline mountain and no balustrade) |
| pt10 | vegetation | Real street is shaded by big plane and ficus trees with a row of cars parked along the blue-lin... | fixed | fixed |
| pt10 | street furniture, prop | Parked cars and bay lines missing, a yellow bus fills the foreground. | partly fixed | partly fixed |
| pt11 | pavements | Game puts the camera on a 20 m wide pale plaza with a thin asphalt strip, where the real street... | fixed | fixed |
| pt11 | street furniture, prop | Cars parked on both sides missing. | partly fixed | partly fixed (stalls and awnings on the ground floor, no parked cars) |
| pt12 | vegetation | Real street is shaded by a huge ficus canopy overhanging a stone garden wall; game has no trees... | partly fixed | partly fixed |
| pt12 | street furniture, prop | Cars are parked on both kerbs in the real street, with blue bay lines; game has an empty road. | partly fixed | partly fixed |
| pt14 | road hidden by terrain | Real roadway dips under a concrete flyover with retaining walls and a bike barrier; the game ha... | still there | still there |
| pt19 | vegetation | Real has tall Washingtonia palms, flowering oleander and a big ficus along a parking-lined seaf... | partly fixed | partly fixed (fan palms now, no ficus) |
| pt24 | facade style and colou | Real left building is a 1950s concrete block with a deep pilotis arcade, shuttered balconies an... | fixed | fixed |
| lm01 | vegetation | Real roadside is a plaster park wall with flowering Judas trees and stone pines; game has a law... | still there | still there (sand yard, no plaster park wall) |
| lm14 | vegetation | Real roundabout edge has dense stone pines, holm oaks and a clipped hedge; game has spruce cone... | partly fixed | partly fixed |
| lm18 | building heights and m | Real street has low 2 to 3 storey old houses, a tile roof factory building and a ficus; game ha... | still there | still there |
| lm19 | road layout, width, ma | Real is a dual carriageway with steel guard rails, an edge line and exit signs, a rust-coloured... | still there | partly fixed (rails and a solid edge line now; no gantry) |
| lm20 | road layout, width, ma | Real is a 3 lane motorway carriageway with steel guard rails both sides, rumble strips, billboa... | still there | partly fixed (rails both sides now; no rumble strips or billboards) |
| lm21 | road layout, width, ma | Real motorway has guard rails on both sides and 3 lanes with a hatched shoulder, scrub verges a... | still there | partly fixed (rails on both sides; no hatched shoulder) |
| lm22 | road layout, width, ma | Real is a 3 lane carriageway with double steel guard rails each side, green gantry sign and dis... | still there | partly fixed (rails on both sides, no gantry or green sign in frame) |
| lm23 | road layout, width, ma | Real is a motorway-grade ring road with steel guard rails, green exit signs on a gantry, scrub... | still there | partly fixed (rail on the left; no gantry) |
| lm24 | street furniture, prop | Real road carries a tram catenary on red poles, a metal fence, a yellow recycling bin, parked c... | fixed | fixed |
| lm26 | street furniture, prop | Real street has cars parked at the kerb, flags of a dealership, traffic lights, a billboard and... | still there | still there |
| lm26 | building heights and m | Real street is lined by 4 to 6 storey blocks and a pine grove; game has a big empty plaza and l... | still there | still there |

## The seven redrawn walls and Piazza Pretoria (extra shots, not in the 180)

Game-only frames, `hero/` in the round folder. Before = the commit before the photo walls were removed (same camera). The photo walls were visible in my before frames only at Palmes and Biondo; at Riso, Gangi and Borsa the before frames show generic grid facades, and at Jung and Malfitano broken panels, so those five were never a photo in this view and are plain gains.

| place | frames | what the game shows now | against the real building | against before |
|---|---|---|---|---|
| Palazzo Belmonte Riso | hb_riso | golden stone, a rusticated arcade of five arches with the portal, pedimented windows over a continuous balcony, small iron-balconied windows under a cornice | right colour and rhythm; the columns of the portal are too small to read from 30 m; sprites stand across the base | big gain |
| Palazzo Valguarnera-Gangi | hb_gangi | cream plaster, terracotta pilasters and frames, a swag frieze, pedimented windows with shutters, central portal | the best of the seven; reads as the palace at first glance | big gain |
| Grand Hotel Piazza Borsa | hb_borsa | long front with a rusticated row of round arches, the bank's name in capitals across the top, small square windows | the real front has tall pedimented windows between pilasters; here the upper floors are a flat wall with small holes | gain, still thin |
| Teatro Biondo | hb_biondo_c, hb_biondo_a, hb_biondo_b | rusticated ground floor of arches with a central entrance and two columns, tall round-arched windows above | right in layout; flatter than the real front | worse in richness, see below |
| Grand Hotel et des Palmes | hb_palmes_a, hb_palmes_b | five-storey cream-yellow front with shutters and small balcony rails, regular grid | reads as an ordinary block; I did not find the entrance canopy or the central balconied block in either frame | worse in richness, see below |
| Palazzo Jung | hb_jung | long white front across a piazza, brown shutters, arched central portal, ground-floor doors | right | big gain (before: floating panels) |
| Villa Malfitano | hb_malf_a, hb_malf_b | two storeys of pale stone, shuttered windows with moulded frames, an arched door, a heavy cornice | right mass and detail; I could not see the four-column portico with its terrace | big gain (before: a blank slab) |
| Piazza Pretoria | hpr_S, hpr_E, hpr_N, hpr_W | the square is framed by the right palaces and the Santa Caterina dome, with the cart and the crowd; the fountain is a low sand-coloured ring wall with small white figures on top and no tiers | the real fountain is a tall tiered marble basin with statues; here it is a parapet. In hpr_S a railed slab floats at the upper right with nothing under it | not shot before |

## New problems since round 3 (regressions and things introduced by the recent work)

Sheets are in the round folder under `sheets/` and `work/` (outside the repo, photos not committed). Strength says how sure I am from a thumbnail.

| id | sheet | what is wrong now | strength |
|---|---|---|---|
| hb_palmes_a, hb_palmes_b | hero2-1, work/ba2, work/ba3 | The photo wall of the Grand Hotel et des Palmes showed an entrance canopy, balcony rows and dressed stone; the drawn wall is a clean yellow block with an even shutter grid. At driving angles it is a step down in character. The canopy and the central block may be in bays I did not frame. | fairly sure for what is in frame |
| hb_biondo_c | work/ba3 | The photo wall showed the colonnade and an iron gate with real depth; the drawn ground floor is a flat arcade with a small portal. Correct layout, less depth. | sure |
| mo25, mo26, mo23, ce13, pe31, po27, mo09 | sheet-13, sheet-15, sheet-16, sheet-02, work/c3, work/c7 | Plain plaster street walls carry one big leaf-shaped peeled patch with a crack beside it, the same shape on every wall. The old repeating small patches on building walls are gone, but on freestanding street walls the stamp is bigger and easier to spot than in round 3 (compare mo25 round 3 and round 4 in work/c3). | checked |
| xsd_0, xvu_0, ce03, ce08, ce18, xba_0, hpn_S | sheet-24, sheet-02, sheet-22, around-04 | Blank old-town faces are drawn as one huge ashlar course pattern with no windows, door or balcony, so a whole street side reads as brick-patterned cardboard. xsd_0 is pixel-near-identical to round 3, so this is unchanged, not new, and the facade work did not touch it. | sure |
| ce22, ce16, ce15, ce04, ce27, su05, su01 | sheet-03, sheet-02, sheet-01, sheet-10, sheet-18 | The same on streets that photos show as five-storey baroque or plain front walls: one flat terracotta or buff slab per side with a few openings. The new window surrounds and shutters do not reach these faces. | sure |
| su24, su17, ce16, su29 | sheet-20, sheet-19, sheet-03 | Stray pieces hang in the air or sit across a lane: floating buff panels and a beam at su24, a grey slab across the lane at su17, a cream panel against the red wall at ce16, a brown slab where the flyover deck should be at su29. Unchanged from round 3, still the most obviously broken things in their frames. | sure |
| su04, su07, su10, lm23 | sheet-10, sheet-11, sheet-18 | Roadside shrubs are still faceted green balls, one filling the lens at su04. Unchanged. | sure |
| po10, pe32 | sheet-04, sheet-08 | Road paint is better (solid white edge lines, zebra crossings at pt04, pt05, pt26) but the yellow lines of the real avenue and of Viale Diana are missing, and po10 has no bus-lane line or median hedge. | fairly sure |
| mo25, lm23 | sheet-13, sheet-11 | The photos stand under green gantry signs; the game has rails now but no sign at those two places. Signs are placed only where OSM carries a destination tag, so a stretch without a tag stays bare. | fairly sure (cause from reading the generator header) |

What I looked for and did not find, so you do not have to look again: a guard rail cutting across a junction or hiding a side street at sheet size in the motorway frames and the three sign frames; a grey or unloaded frame (only ce18, which faces a wall); a wall where the photo shows an obvious fence at su44, su41 or su38 (the walls there are plausible, su44 keeps its iron railing); any of the 147 rows going backwards.

## What is still most wrong, ranked by how visible it is to a player driving around

Size guesses as in earlier rounds: small is a tuning change, medium is a few days of a lane, large is new models or a data pass, needs a map rebake means the bake must run again. File names are guesses from reading the source, not a check. Ranked by how much of the screen it covers and how often a player passes it, not by how hard it is.

1. **Tree look and species.** Where: every avenue and park. Ids: po09, po10, pt10, pt11, pt12, pe32, pe06, ce12, su18, su08, su09, lm14, xfa_0. Avenue crowns are still flat green plates on identical grey trunks and close over the road like a ceiling; the photos have round open crowns of plane, ficus and holm oak, and stone pines in long tunnels along Viale Regione Siciliana (su08, su09: still one lone tree). The bare planes of su13, zi08 and zi09 and the new palms show what the fix looks like. Size: large. Files: `src/treegeo.js`, `src/species.js`, street-tree placement in `src/world.js`.
2. **Outskirts with no buildings and wrong surfaces.** Where: everything beyond the old town and the post-war belt. Ids: su02, su17, su24, su26, su44, lm18, lm26, zi18, zi21, su29, su45, pt14. Open ground, a roundabout with no island, a yard where a carriageway should be, a flyover that is only an underside. The photos show low houses, walls and a landscaped island. Size: large, needs a map rebake for the footprints and road surfaces. Files: `tools/footprints.py`, `tools/tiles.py`, `tools/road_surfaces.py`, `src/bridges.js`.
3. **Flat blank faces in the old town.** Where: the streets a player drives most. Ids: ce22, ce16, ce15, ce04, ce27, su05, su01, xsd_0, xvu_0, ce03, ce08, ce18. Each side of a street is one slab with a few openings, or a huge ashlar pattern with none, where the photos show five storeys of balconies, shutters, doors and shops. The new surrounds, pediments and rusticated floors exist, so the missing piece is applying them to the big faces (and giving blank walls at least doors and a ground-floor shop row). Size: medium. Files: `src/buildings.js`, `src/wall-tex.js`.
4. **The landmarks are thinner than the places.** Where: the centre, the first place a player goes. Ids: xqc_0, xqc_1, xqc_2, hpr_S, hpr_E, hpr_N, hpr_W, xtm_0, xtm_1, hb_borsa, hb_palmes_a, hb_biondo_c. Quattro Canti has the concave fronts and the niches but no carved stone, statues or balcony depth; the Pretoria fountain is a plain ring wall (and a railed slab floats at hpr_S); Palmes and Biondo lost depth when the photos left. Size: medium to large. Files: `src/landmarks.js`, `src/hero-facades.js`.
5. **The stamped peel and the tall plain street walls.** Where: roadside walls on the fast roads and the coast. Ids: mo25, mo26, mo23, ce13, pe31, po27, mo09, su19. One leaf-shaped peeled patch with a crack repeats on every plaster street wall, and several walls are 4 m tall and plain where the photos show a low wall with trees behind (mo26, po27) or an iron fence. Size: small. Files: `src/wall-tex.js`, `src/fences.js` (mapped walls, not `src/fence-walls.js`, as in round 3).
6. **Road wear reads as holes and rectangles.** Where: every road. Ids: lm09 (a bowl with a rim under the camera), su45 (a hexagonal pit), pt24 (a puddle hole), su13, su34, zi15, lm22, po25 (dark rectangular patches in rows). Fewer pits than round 2, but the rectangular patches are now the most repeated mark on asphalt, and the lane edge in the photos is clean. Size: small. File: `src/roadwear.js`.
7. **Expressway leftovers.** Where: Viale Regione Siciliana, the A29 raccordo, the Circonvallazione. Ids: mo25, lm23, lm21, lm20, po25, zi17, su09, su29. Rails and edge lines are in; missing are gantries at places without an OSM destination tag (mo25, lm23), hatched shoulders and gores (lm21), rumble strips, billboards, tall twin lamps and the scrub verge, the flyover deck (su29) and the viaduct wall at zi18. Size: small to medium. Files: `src/expressway.js`, `src/direction-signs.js`, `tools/expressway_signs.py`.
8. **Mountains on the skyline from the sea side.** Where: the Foro Italico, the hairpin under Pellegrino, the Lungomare. Ids: pt01 to pt05, yp_0 to yp_2, pe08, pe15, pe19, pe31. Pellegrino is a small crag behind the trees from the seafront where the photos make it the skyline; pe08 is still a huge pale slab; pe15 and pe19 are bare sand slopes where the photos have rubble walls, oleander and pines; the cliff at pe31 looks corrugated. Size: medium. Files: `src/world.js` terrain, `tools/terrain_check.py`.
9. **Street life patchy.** Where: residential streets and the market streets. Ids: pe21, zi20, zi31, su43, mo05, po01 (cars on one side only), ce04, ce27 (no cafe tables or planters on Via Maqueda), ce32 (no stalls), po19 and su07 (no petrol station), lm26 and po31 (no mast-arm traffic lights), xcp_0 and xvu_0 (the markets). Size: small to medium. Files: `src/props.js`, `src/markets.js`.
10. **Stray geometry and toy shrubs.** Where: a few junctions and the outskirts. Ids: su24, su17, ce16, su29 (floating panels, a slab across a lane, a deck that is only an underside), su04, su07, su10, lm23 (green ball shrubs), su04 (no tram on Corso dei Mille). Small in area but they are the most obviously broken pieces in their frames. Size: small. Files: shrub model in `src/props.js`, `tools/tram.py`, `src/trams.js`.

Not ranked: the cars are low-poly boxes in every frame and dominate the foreground of most shots (white and red blocks with a dark windscreen); the photos are real cars. This may be a style choice for the game, so it is the owner's call rather than a gap.

Round 3's ranked list, status now (judged by the picture): 1 trees partly better (bare planes, palms), avenue plates unchanged; 2 outskirts unchanged; 3 road wear unchanged; 4 motorway roads improved, now partly fixed; 5 missing road or wrong surface unchanged; 6 old-town facade character improved on the named palaces and some streets, big slabs unchanged; 7 Pellegrino from the seafront unchanged; 8 street life unchanged; 9 tall plain walls unchanged, stamp more visible; 10 Corso dei Mille tram and toy shrubs unchanged.

Others still open and not in the top ten: tan verges (po22, su41, su45, su10, zi21), Via Guglielmo il Buono without its stone wall (ce15), the Barbera park wall (lm01 shows sand), the hedge at po08, the SUCA tag on a facade at ce27, bunting strings at ce15 and the cathedral sheet, the blue and pink mission beams in a few frames.

## Things I could not judge

ce01, ce02 and ce01_p (under a cafe awning: judged from the xqc crossing shots instead), ce03 (camera against a wall, the photo is a close-up of paving), ce18, mo09, su01 and po24 (camera inside or against a wall), po11 and ce37 (roadworks hoardings), the pano crops mo06, mo07, mo18, su26 (a stretched crop, no view of the roundabout), and xvu_0 (the Mapillary photo is a night shot of Vucciria, not comparable). ZEN, Porta Nuova, La Zisa, Santuario and Castello Utveggio, and Mondello pier were again not comparable for lack of a photo or a usable view; the game-only views of ZEN (gze_0 to gze_3) and Porta Nuova (hpn_*) look plausible for the place and are judged from knowledge, not a picture. The seven redrawn buildings and Piazza Pretoria were judged against my knowledge of the buildings and the sources named in `assets/facades/specs.js`, not against a Mapillary pair. Sign lettering on the gantries is unreadable at the size of the sheets, so I can say that the signs exist and are green boards in sensible places, not that the place names are right. The Palmes entrance and the Malfitano portico are not in any frame I took, so I do not know whether they are drawn. I did not run the game with `?nostreetwalls` this round, so the peel-stamp cause (a wall texture, not the street-wall rule) is from comparing frames, not from a switch. No extra Mapillary photo was fetched.

## Re-running this round

`tools/faith_round.sh [ROUND_DIR] [PORT]` does the whole thing, but it downloads photos. For round 4 I ran the steps by hand so nothing was downloaded: `ref/` linked and `meta/` symlinked file by file from round 3, `git archive HEAD` into `ROUND_DIR/game`, served it on its own port, ran `tools/faith_shoot.mjs --settle 4500 --ids ...` through the shared browser slots (it launches Chrome with `--mute-audio`), then `tools/faith_sheet.py` three times (main, `--only x`, `--grid`). The extra shots are meta files with game metres `x`, `z` and an eye height, shot with the same script and moved out of `shots/` so the grid sheets keep their 25. The shoot script needs `tools/build/node_modules` (puppeteer-core), which a fresh worktree does not have; I linked the main checkout's folder, which is gitignored. Photos, shots and sheets land in `ROUND_DIR`, outside the repo, and the game snapshots were deleted at the end.
