# Faithfulness survey, round 3: the game against Mapillary photos, a third time

Date: 3 November 2026. Game commit shot: 7bd7e17 (a `git archive` snapshot of HEAD, served on its own port, so other people's edits did not change the round). Reviewer: one pass, no fixes made. Nothing here is copied from a photo; the photos were only looked at and live outside the repo.

## What was compared

- **Same set as round 2, nothing skipped.** 138 pairs at the survey viewpoints that have a Mapillary photo (game camera at the photo's own position and heading, 1.6 m up, 60 degrees vertical fov, 11:00, UI hidden, car hidden, 1024 by 768), 17 pairs at the extra places (xqc, xtm, xpo, xmo, xpr, xsd, xvu, xcp, xsc, xsr, xba, xfa), and 25 game-only views (Cattedrale, Normanni, Porta Nuova and Teatro Massimo stand-off shots, Vucciria and ZEN in four headings, three extra headings at the Foro Italico). That is 180 shots, all of them looked at.
- **The photos were reused from round 2** (`ref/` and `meta/` copied, nothing downloaded; `tools/mapillary_refs.py` and `tools/mapillary_extra.py` were not run). Each shot had 4.5 s of settle after the world reported itself calm. 180 of 180 shot on the first pass, none flagged unsettled, and a per-image variance check found no grey frames. ce03 and ce18 are low-detail only because the camera faces a wall close up.
- Sheets read: 26 survey sheets (6 pairs each, game left, photo right), 5 game-only sheets, and two small composites to look closer at ce15, mo25, su16, po27 and the Foro Italico horizon: 33 image reads. The sheets are 384 by 288 per picture, so small detail (a sign, a fence type) is weak evidence; I say so where it matters.
- What changed in the game since round 2 and was looked at on purpose: trees with real crowns and avenue canopies, old-town facades (aged plaster, varied windows and ground floors, balconies in runs), post-war blocks and the height-based style choice, mountains from the 25 m elevation data, and the outskirts work (cracked yards instead of slab plains, roadside walls instead of railings). Also the worn-asphalt and dusty-verge pass.

Caveats, the same as round 2. Photos are 0.1 to 12 years old; I did not count roadworks hoardings (po11, ce37, pt07, pt04) as defects. A phone compass heading is not always right. Where the game camera ended up inside a wall or an alley (ce18, mo09, su01, po24) the pair is can't tell. Walking sprites sometimes stand in front of the lens, and a crashed car lies on its side in po23 (that is a game event, not a defect). The panorama pairs (mo06, mo07, mo18, mo21, mo22, su09, su37) are crops of an equirectangular picture and are stretched. Statuses are from one person looking at thumbnails once; borderline calls between fixed and partly fixed could go either way.

## Counts

Old high findings in `round-2.md` (147 rows), each checked against the new shot:

| status | round 2 | round 3 |
|---|---|---|
| fixed | 36 | 46 |
| partly fixed | 30 | 43 |
| still there | 69 | 46 |
| can't tell (no usable view, temporary object, camera in a wall) | 12 | 12 |

Note the round 2 column was judged against the round 1 findings, and round 3 against the round 2 table, so a few rows moved by reading the photo differently rather than by a game change.

What improved, from what I saw:

- **Avenues now close over the road.** Via della Liberta (po02, po09, po10), Via Basile (su13), Viale Michelangelo (zi08, zi09), Via Imperatore Federico (pt10, pt11), Viale Lazio (po31), Viale Diana (pe32), Filippo Paruta (su18). Round 2 had single ball trees. Parked cars now line most of these streets too.
- **Mountains read as mountains.** Monte Gallo and Pellegrino behind Mondello (mo02, mo05, mo12), the limestone cliff over Lungomare Colombo (pe14, pe16), the cliff closing Via Nostra Donna del Rotolo (pe31), the grey scree slope above Via Falsomiele (su19) and the ridges on the horizon at zi06, zi15, zi21, lm19 to lm21 all have rock bands and scrub, not a pale ramp.
- **Post-war blocks look post-war.** Balconies in every bay and a shop row at the bottom on Via Notarbartolo (po22, po23), Via Montepellegrino (po18, po19), Francesco Crispi (po12), Giuseppe Giusti (pt24), Lenin Mancuso (su11). Round 2 had windows in a flat slab.
- **Old-town ground floors have a life.** Arched doors, balcony canopies and awnings at ce16, ce27, ce05; fruit stalls and awnings on Via Imperatore Federico (pt11); shutters at zi31 and su06; Stazione Centrale (xsc_0) has iron balconies and a shopfront, not a block of equal windows.
- **The pale slab plains are gone from the outskirts.** Beyond the old town the ground between blocks is a cracked, dusty yard (ZEN in gze_0 to gze_3 now looks right for ZEN, su45, zi18, su34), and fences along the road are often plaster, block or stone walls (su38, su39, su41, pe21, pe22, pe23).
- Road wear is paler and less holey on most streets (the black hexagonal pits of round 2 are mostly grey patches now), and the Foro Italico palms (pt01 to pt05, pt19) have full crowns.

## Old high findings, one by one


| id | layer | old finding (shortened) | status now |
|---|---|---|---|
| ce01 | landmarks | Quattro Canti is unrecognisable at the viewpoint: real view is the open octagon with two huge b... | fixed (crossing seen in xqc_0 to xqc_2 (concave fronts, fountain, niches, lamps); ce01 itself is under a cafe awning) |
| ce01_p | landmarks | At the crossing itself the game still shows no octagon: a blank buff wall with a red awning at... | can't tell (photo spot is under a cafe awning, no facade in frame) |
| ce02 | landmarks | Same as ce01. | fixed |
| ce04 | pavements | Real street is an asphalt road with a white edge line and dashed lane marks, narrow stone pavem... | fixed |
| ce05 | pavements | Real: asphalt road with dashed centre line and stone kerbs, pedestrians walking in the road; ga... | fixed |
| ce09 | pavements | Real street is a 9 m asphalt road with a white centre line, shop terraces and pedestrians; game... | still there (slabs across the whole piazza, photo is an asphalt street with a centre line) |
| ce09_p | pavements | The game ground here is a tan terrain-tint plain instead of an asphalt road with a centre line,... | still there |
| ce10 | landmarks | Game cathedral side is a flat buff wall with pointed lancet windows and a battlement; the real... | fixed |
| ce10_p | landmarks | Cathedral is present with the right overall layout (battlemented wall, a square tower at the le... | fixed |
| ce12 | vegetation | Real roadside has stone pines, bare planes and a palm; game has lime lawn with spruce cones and... | partly fixed (bigger low-poly crowns now, but not stone pines or bare planes) |
| ce12 | walls, gardens, fences | The long bastion wall of the palace on the right (grey-ochre, 8 m high, sloping base) is missin... | fixed |
| ce12_p | walls, gardens, fences | The 8 m high palace bastion wall along the right of the road is absent; the game shows open law... | fixed |
| ce12_p | vegetation | Spruce cones at the horizon instead of stone pines, bare planes and a palm. | partly fixed (umbrella crowns, not stone pines) |
| ce15 | vegetation | Real left side is a tall dressed-stone retaining wall under big ficus and holm oak; game has a... | partly fixed (a big crowned tree stands in front of the slab, no ficus over a stone wall) |
| ce15 | walls, gardens, fences | The retaining wall is replaced by building massing; the upper palazzo set back behind the wall... | still there (still a plain slab, no retaining wall) |
| ce16 | facade style and colou | Real lane is an old-town alley: arched wooden doors, wrought-iron balcony canopies, cream and o... | partly fixed (arched door, balcony canopies and an awning on the right; the left is a blank red wall) |
| ce18 | facade style and colou | Real alley is a 4 m canyon of weathered terracotta and ochre plaster with a dark painted skirt,... | can't tell (camera inside a wall) |
| ce22 | facade style and colou | Real street walls are 5 storey baroque palazzi with deep wrought-iron balconies on carved stone... | partly fixed (right side has balconies and varied windows; the left face is flat terracotta) |
| ce27 | pavements | Real street is asphalt with a white edge line, a stone kerb and terracotta planters; game paves... | fixed |
| ce32 | pavements | Game has a big tan sand patch on the left of the carriageway and a long skid rectangle; real ha... | fixed |
| ce32 | street furniture, prop | Real street is full of moving and parked cars and shop awnings with stalls at the kerb; game ha... | partly fixed (cars parked along the kerb now; no stalls or awnings at the kerb) |
| po01 | street furniture, prop | Real street has cars parked on both kerbs, bikes, dustbins and a yellow edge line; game has an... | partly fixed (balconies and shutters now; cars on one side only) |
| po02 | vegetation | Real avenue is a continuous canopy of plane and jacaranda trees along both sides of Via Ruggero... | fixed (rows of trees close over the street) |
| po08 | walls, gardens, fences | Real left side is a tall dark-green iron railing on a stone plinth along a garden, with leaves... | still there (still a flat box hedge, no iron railing on a plinth (camera sits in it)) |
| po11 | pavements | Real right side is a continuous construction hoarding with concrete barriers and billboards; ga... | can't tell (roadworks hoarding, not counted) |
| po12 | road layout, width, ma | Real road is a narrow one-way service lane (about 6 m) with parked cars along the kerb, running... | partly fixed (post-war block with a flat in every bay; road still wide with no parked rows) |
| po18 | street furniture, prop | Real street is lined with cars on both kerbs, motorbikes and a speed-limit sign; game has a yel... | partly fixed |
| po19 | street furniture, prop | Real has parked cars along both sides in a continuous row, an ESSO station with a red canopy an... | partly fixed |
| po22 | street furniture, prop | Real street has an iron-railed tram median with overhead wires, queued cars, and a hedge and tr... | fixed (tram railing and wires) |
| po23 | street furniture, prop | Real left side is a black iron railing on a concrete plinth guarding the tram line, with overhe... | fixed |
| po24 | street furniture, prop | Real has an Osteria sign, an Italian flag on the palazzo, shop fronts at street level, scooters... | can't tell (camera stands against a shopfront, no Osteria sign) |
| po25 | road layout, width, ma | Real road is a motorway-grade carriageway with double steel guard rails on both sides, a hatche... | still there (three lanes but no guard rails or gantry) |
| po27 | vegetation | Real left is a median planted with large ficus and broadleaf trees, right side has parked cars... | partly fixed (big canopy trees at the plaza, no median) |
| po27 | street furniture, prop | Cars parked bumper to bumper on the right kerb, a cafe terrace with awning: missing. | can't tell (a plain plaster wall now stands in front of the shops, see regressions) |
| po31 | vegetation | Real avenue has big plane trees overhanging both kerbs, a palm and a stone-pine row; game has b... | fixed (canopy over the road, parked cars both sides) |
| po31 | street furniture, prop | Cars parked on the right kerb with blue-line bays, traffic lights on mast arms, a road sign: mi... | partly fixed |
| po34 | walls, gardens, fences | Real right side is a 5 m transparent and black noise barrier on a raised ramp with a guard rail... | still there (paved plaza and a plain, no noise barrier) |
| mo01 | walls, gardens, fences | Real left side is a continuous plastered garden wall with villas, palms and parked cars behind... | partly fixed (verge and trees, no villa wall in frame) |
| mo02 | walls, gardens, fences | Real left is a white plastered wall with a gate, tropical shrubs over it and parked cars; game... | fixed |
| mo05 | walls, gardens, fences | Real right side is a dense tall hedge and tree wall behind a kerb, left side has parked SUVs al... | partly fixed |
| mo06 | walls, gardens, fences | Real street is a 6 m lane between plaster garden walls and hedges under mature stone pines and... | can't tell |
| mo09 | vegetation | Game fills the roadside with a grove of fat, 15 m tall palm trunks with spiky crowns; real road... | can't tell |
| mo09 | walls, gardens, fences | Real left side is a rubble stone retaining wall topped with an iron fence and a villa garden; g... | can't tell |
| mo12 | pavements | Real road runs straight between garden walls and hedges with trees overhead, asphalt to the ker... | fixed |
| mo12 | walls, gardens, fences | Garden walls, plaster fences, tree canopy and a parked car row missing. | partly fixed |
| mo18 | walls, gardens, fences | Real lane is hemmed by a rubble wall topped with a diamond mesh fence on the right and a villa... | can't tell |
| mo20 | walls, gardens, fences | Real right side is villa gardens with a brick or stone wall, gates and cypress; game has a pale... | partly fixed |
| mo23 | walls, gardens, fences | Real right side is a tall stone gate pier with iron gate and a long wall; left has a plaster vi... | partly fixed |
| mo25 | road layout, width, ma | Real road at this point is a motorway-grade ramp towards the A19/A20 with steel crash barriers... | still there (now a tall plain wall where the photo has steel guard rails, see regressions) |
| mo26 | vegetation | A single huge spruce cone stands beside the road; real roadside is broadleaf trees, olive and b... | partly fixed (broadleaf low-poly trees replace the spruce cone, but a tall plain wall stands at the road (regression, see below)) |
| pe06 | walls, gardens, fences | Real road has a continuous 0.8 m dry-stone parapet on the valley side and a rock cut with grass... | fixed |
| pe06 | vegetation | Real slope is dry grass tufts, shrubs and a few Aleppo pines; game has 20 m tall spruce cones a... | partly fixed (umbrella pines instead of spruce cones; the slope is still a smooth pale wedge) |
| pe08 | terrain | Real hairpin runs under an overhanging ochre limestone cliff with rock outcrops and a grassy ve... | still there (still a huge pale slab) |
| pe13 | walls, gardens, fences | Real left side is hedge-covered garden walls with iron gates and villas; game has a wide pale p... | partly fixed |
| pe14 | walls, gardens, fences | Real left is a plaster and brick wall with a decorative iron gate, bougainvillea and oleander a... | fixed |
| pe14 | pavements | The pale paved slope at the foot of the cliff replaces the real rock face with scrub. | fixed |
| pe15 | walls, gardens, fences | Real right side is a tall rubble stone retaining wall with a mesh fence; sea side has a steel c... | still there (slope is bare sand with pines, no rubble wall) |
| pe16 | walls, gardens, fences | Real right side is a white stone-clad garden wall topped by a clipped hedge and trees; game has... | fixed |
| pe19 | walls, gardens, fences | Real lane is 4 to 5 m between an oleander hedge with grass verge (left) and a retaining wall wi... | still there (pale slope, no hedge or wall) |
| pe19 | vegetation | Oleander in flower and Aleppo pine umbrellas missing. | still there (no oleander) |
| pe21 | walls, gardens, fences | Real right side is a continuous 3 m masonry wall (long, stuccoed) with cypress behind; game has... | fixed |
| pe21 | street furniture, prop | Cars parked bumper to bumper on both kerbs; game has none. | still there (no parked cars) |
| pe22 | walls, gardens, fences | Same long tall wall and plane trees in the real photo; game shows sand bands, a pale pavement a... | fixed |
| pe23 | walls, gardens, fences | Real right side is a 3 m ashlar stone wall with oleander and cypress behind, left has plaster w... | fixed |
| pe29 | street furniture, prop | Real street has cars parked along both kerbs, nose to tail; game has two dumpsters and an empty... | fixed |
| pe31 | terrain | Real street frames the grey limestone wall of Monte Pellegrino at the end of the street; game v... | fixed |
| pe31 | walls, gardens, fences | Real right side is a low stone wall with a mesh fence and a reed thicket; left has fences and g... | partly fixed |
| pe32 | vegetation | Real avenue is a tunnel of mature broadleaf oaks and poplars with dry grass and orchard trees b... | partly fixed (a canopy tunnel of umbrella pines over olive grass; the photo is oak and poplar over dry grass) |
| zi05 | street furniture, prop | Real avenue has a tram line behind a black iron railing with red overhead-wire poles, tram stop... | fixed |
| zi07 | street furniture, prop | Real central reservation carries a tram line with red overhead poles, a black iron railing, and... | fixed |
| zi08 | vegetation | Real avenue has a double row of mature plane trees on both sides and a hedge strip; game has no... | fixed (double rows of planes with a canopy) |
| zi09 | vegetation | Real roadside has plane trees, a stone pine and a palm; game has bare sand and tan paving. | fixed (trees both sides with a canopy; no palm or stone pine) |
| zi09 | pavements | Game road sits on a 10 to 15 m wide tan band and blank pale apron; real asphalt runs straight t... | fixed (asphalt to the edge with a green verge, tan band gone) |
| zi15 | road layout, width, ma | Real is a 3 lane motorway-grade carriageway with continuous steel guard rails, solid white edge... | still there |
| zi16 | road layout, width, ma | Real is a 3 lane carriageway with solid edge lines, steel guard rails both sides, tufted scrub... | partly fixed |
| zi17 | road layout, width, ma | Real is a curving expressway ramp with a guard rail, grass verge, a big stone pine and heavy tr... | still there |
| zi18 | pavements | Real road is a 3 lane carriageway with a concrete retaining wall and railings on the right and... | partly fixed (cracked yard texture under the camera instead of stone paving; still no carriageway or markings) |
| zi18 | road layout, width, ma | The tram viaduct wall and guard rail are absent. | still there (no viaduct wall or rail) |
| zi19 | street furniture, prop | Real central reservation carries a tram line with red overhead-wire poles, iron railings and si... | fixed |
| zi20 | street furniture, prop | Real street is packed with cars parked double-deep on both sides, shop awnings and a tabacchi s... | still there |
| zi21 | street furniture, prop | Real left side is a tram line with iron fence and red poles; right has a white noise barrier on... | partly fixed (poles and rail present, road itself missing) |
| zi21 | vegetation | Giant ficus canopy over the road is missing. | still there (still a bare sand plain, no ficus) |
| zi28 | walls, gardens, fences | Real lane runs between iron-railed walls and a green mesh fence with a stone-and-concrete gate... | fixed |
| zi28 | vegetation | Eucalyptus avenue and shrubs missing. | partly fixed |
| zi28 | building heights and m | Real road has fenced gardens and villas on both sides; game has empty ground (missing buildings... | still there |
| zi31 | street furniture, prop | Real street has cars parked bumper to bumper on both kerbs; game has none. | partly fixed |
| zi33 | walls, gardens, fences | Real right side is a 3 m precast concrete wall with a rusty spiked fence on top, left is a scru... | fixed |
| su01 | street furniture, prop | Real street is a busy shopping street with parked scooters, cars both sides and shop signs in r... | can't tell |
| su02 | building heights and m | Real junction is a busy street with market stalls under white awnings, 5 to 8 storey blocks on... | still there |
| su04 | street furniture, prop | Real central reservation has a tram line with red overhead poles and decorative iron railings,... | still there (no tram, and a large faceted green ball bush fills the lens) |
| su05 | street furniture, prop | Cars parked along both kerbs, shop awnings and a person at the kerb; game has none, only an emp... | partly fixed |
| su06 | street furniture, prop | Real street has cars parked on both kerbs, a dumpster, shop shutters and laundry hung on balcon... | partly fixed |
| su07 | street furniture, prop | Real roadside has an IP petrol station with canopy and price sign, billboards and arching lamp... | still there |
| su08 | vegetation | Real road runs under a continuous tunnel of stone pines (umbrella crowns, 15 m) next to a steel... | still there (one lone umbrella tree, no tunnel of pines) |
| su09 | vegetation | Real road has a long row of stone pines and palms on a planted median with a steel guard rail a... | still there |
| su09 | road layout, width, ma | Median with guard rail and lamp posts missing; game has a flat single carriageway. | still there |
| su10 | road layout, width, ma | Real is a raised expressway with double steel guard rails, mesh fence and tall twin-arm lamps n... | still there |
| su11 | street furniture, prop | Real street has cars parked nose to tail on both kerbs and a central strip with shrubs; game ha... | partly fixed |
| su12 | street furniture, prop | Real side street has cars parked along both kerbs and graffiti-covered wheelie bins; game has o... | fixed |
| su13 | vegetation | Real avenue has a long row of pollarded plane trees on both kerbs; game has none. | fixed (rows of planes on both kerbs) |
| su16 | pavements | Real junction is clean asphalt with kerbs and recycling bins; game has a tan terrain plain with... | partly fixed (no pale slab, but a cracked lot with cars rather than a kerbed junction) |
| su17 | walls, gardens, fences | Real lane runs beside a 2 m concrete wall with a plaque, reeds, stone pines and cypresses; game... | still there |
| su17 | vegetation | Reeds, pines and cypress missing. | still there |
| su17 | pavements | Game has 20 m of pale paving beside a 6 m road; real is a lane with a walled edge. | still there (the grey slab still floats across the lane) |
| su18 | vegetation | Real street is an avenue of broadleaf trees with a canopy over the road and recycling bins; gam... | fixed (an avenue with a canopy, as in the photo) |
| su18 | building heights and m | Real street is enclosed by houses and walls; game has open ground. | still there (open road, houses far off) |
| su19 | walls, gardens, fences | Real lane is a 3.5 m strip between a whitewashed rubble wall (left) and a dry-stone terrace wal... | partly fixed |
| su19 | terrain | Real mountain is a steep grey limestone face with green scrub terraces; game slope is a smooth... | fixed (mountain with limestone bands and scrub) |
| su24 | building heights and m | Real junction is a rural village edge with 1 to 2 storey houses behind rubble and plaster walls... | still there |
| su24 | walls, gardens, fences | Whitewashed and rubble garden walls, an iron gate and road signs missing. | still there (wide slab paving under the camera, no walls or gate) |
| su26 | road layout, width, ma | Real is a landscaped roundabout with kerbed island, shrubs, give-way and roundabout signs, a lo... | still there (no island, a plain with kerbs) |
| su26 | building heights and m | Real horizon has a fenced industrial yard, tank, and a railway embankment with overhead wires;... | can't tell |
| su29 | road layout, width, ma | Real is an elevated viaduct with concrete parapet, lamp posts and trucks; game is a road across... | partly fixed (deck drawn as a brown underside slab, no road on it) |
| su34 | walls, gardens, fences | Real lane is hemmed by a 4 m rough ashlar wall on the right with weeds and a plastered farmhous... | partly fixed |
| su38 | walls, gardens, fences | Real lane has 2 m plastered garden walls with gates and a row of parked cars under trees; game... | fixed (plain walls on both sides, as in the photo) |
| su39 | walls, gardens, fences | Real left side is a long rubble stone wall with a wrought-iron fence and a stone pine; game has... | partly fixed |
| su41 | walls, gardens, fences | Real left side is a 2 m orange works hoarding and a wall with an iron gate; right has cars park... | partly fixed (walls both sides, photo has hoarding and a railing wall) |
| su43 | street furniture, prop | Real street has cars on both kerbs, a stepped brick pavement and balcony plants; game has an un... | still there |
| su44 | walls, gardens, fences | Real road runs between a ruined ashlar farmhouse wall (right) and a guard rail with dense Medit... | still there (iron railing stays, photo has a ruined wall) |
| su44 | building heights and m | Real tall rough-cut stone ruin and tree canopy missing; confirms the south coast plain finding. | still there |
| su45 | vegetation | Real roadside has eucalyptus, birches and bamboo; game has bare ochre ground with sparse traffi... | still there |
| pt01 | vegetation | Real seafront has tall Washingtonia and Phoenix palms and big clipped pittosporum hedges; game... | fixed |
| pt02 | landmarks | Real view ends at a neoclassical colonnaded gateway with a lion-topped pediment (Porta dei Grec... | can't tell |
| pt03 | vegetation | Date palms in groups, shrubs and a stand of pines are replaced by spruce cones and ball trees. | fixed |
| pt03 | pavements | Game road sits on 15 m sand bands left and right; real road has a kerb and pavement with a stal... | fixed |
| pt04 | vegetation | Real left has a fence with orange netting (works) and tall Washingtonia palms plus a stone balu... | fixed |
| pt04 | coastline and sea | No balustrade or sea wall in the game; the real right side has a stone balustrade with posts. | partly fixed (Pellegrino shows in yp_0 as a small pale crag behind the trees; the photo has it as the skyline) |
| pt10 | vegetation | Real street is shaded by big plane and ficus trees with a row of cars parked along the blue-lin... | fixed |
| pt10 | street furniture, prop | Parked cars and bay lines missing, a yellow bus fills the foreground. | partly fixed |
| pt11 | pavements | Game puts the camera on a 20 m wide pale plaza with a thin asphalt strip, where the real street... | fixed |
| pt11 | street furniture, prop | Cars parked on both sides missing. | partly fixed (shop stalls and awnings on the ground floor now; no parked cars) |
| pt12 | vegetation | Real street is shaded by a huge ficus canopy overhanging a stone garden wall; game has no trees... | partly fixed |
| pt12 | street furniture, prop | Cars are parked on both kerbs in the real street, with blue bay lines; game has an empty road. | partly fixed |
| pt14 | road hidden by terrain | Real roadway dips under a concrete flyover with retaining walls and a bike barrier; the game ha... | still there (flat road, no flyover) |
| pt19 | vegetation | Real has tall Washingtonia palms, flowering oleander and a big ficus along a parking-lined seaf... | partly fixed |
| pt24 | facade style and colou | Real left building is a 1950s concrete block with a deep pilotis arcade, shuttered balconies an... | fixed (tall post-war blocks with balconies and ground-floor shops, close to the photo) |
| lm01 | vegetation | Real roadside is a plaster park wall with flowering Judas trees and stone pines; game has a law... | still there (sand yard where the photo has a plaster park wall and trees) |
| lm14 | vegetation | Real roundabout edge has dense stone pines, holm oaks and a clipped hedge; game has spruce cone... | partly fixed (pine-like crowns at the horizon, no clipped hedge) |
| lm18 | building heights and m | Real street has low 2 to 3 storey old houses, a tile roof factory building and a ficus; game ha... | still there |
| lm19 | road layout, width, ma | Real is a dual carriageway with steel guard rails, an edge line and exit signs, a rust-coloured... | still there |
| lm20 | road layout, width, ma | Real is a 3 lane motorway carriageway with steel guard rails both sides, rumble strips, billboa... | still there |
| lm21 | road layout, width, ma | Real motorway has guard rails on both sides and 3 lanes with a hatched shoulder, scrub verges a... | still there |
| lm22 | road layout, width, ma | Real is a 3 lane carriageway with double steel guard rails each side, green gantry sign and dis... | still there |
| lm23 | road layout, width, ma | Real is a motorway-grade ring road with steel guard rails, green exit signs on a gantry, scrub... | still there |
| lm24 | street furniture, prop | Real road carries a tram catenary on red poles, a metal fence, a yellow recycling bin, parked c... | fixed (tram catenary and rail) |
| lm26 | street furniture, prop | Real street has cars parked at the kerb, flags of a dealership, traffic lights, a billboard and... | still there |
| lm26 | building heights and m | Real street is lined by 4 to 6 storey blocks and a pine grove; game has a big empty plaza and l... | still there |

## New problems since round 2 (regressions and things introduced by the recent work)

Sheet paths are in `/private/tmp/claude-501/round3/sheets/` (outside the repo, photos not committed). Strength says how sure I am from a thumbnail.

| id | sheet | what is wrong now | strength |
|---|---|---|---|
| mo25 | sheet-13 | A tall plain plaster wall runs along the right of the road where the photo shows a motorway ramp with double steel guard rails and a gantry. Not a regression: the frame is the same with `?nostreetwalls`, so this is a mapped wall, not the new roadside rule. | checked |
| mo26 | sheet-13 | The same tall wall along the right of Via Rosario Nicoletti. The photo has a low wall with trees behind. Too tall and too plain, but also not a regression: same frame with `?nostreetwalls`. | checked |
| po27 | sheet-16 | A plain plaster wall stands on the pavement hiding the ground-floor shops (their signs show above it), where the photo has a kerb, parked cars and a planted median. Same frame with `?nostreetwalls`, so it is a mapped wall and not the new rule. It may be a real hoarding in the 2017 photo's time. | checked, cause only |
| su04, su07, su10, lm23 | sheet-10, sheet-11, sheet-18 | Roadside shrubs are single faceted green balls: a huge one fills the lens at su04, smaller ones at su07, su10 and lm23. They read as toy spheres next to the better tree crowns. I cannot say they are new since round 2 (round 2 did not mention them), but they sit beside the new trees. | fairly sure that they look wrong, unsure when they appeared |
| xtm_0, su05, mo25, pe31, hca_E, hca_W | sheet-24, sheet-10, sheet-13, sheet-15, around-02 | The same tan crumpled patch (a torn-poster or plaster-patch shape) shows up on many plaster walls. Seen once it reads as wear, seen across a street it reads as a stamp. | fairly sure |
| po09, po10, pt10, su13 | sheet-04, sheet-16, sheet-19 | New avenue crowns are flat angular plates on grey Y-shaped trunks, all the same, and in a row they close like a green ceiling. The photos show round open crowns of planes, ficus and holm oak. This is a better problem than ball trees, but a Palermitan will see a cartoon forest. Trunks in the lane edge also block the view (po09, pt12). | sure that the look is off, a matter of taste how bad |
| su16, su34 | sheet-19, sheet-20 | The new cracked yard reads as a car park: at su16 a whole junction is a lot with cars scattered on it, at su34 the car stands on a dirt plain at the lane edge. The photos are kerbed asphalt (su16) and a narrow lane between walls (su34). Better than round 2's slab, not right. | fairly sure |
| su24 | sheet-20 | The camera stands on wide pale slab paving with a lone pole and a floating buff panel; the 3 m edge rule that keeps slab beside a raised polygon kept this one slab. The photo is a junction between walls with a pine. Unchanged from round 2 in kind. | sure |
| zi18, zi21 | sheet-25, sheet-26 | zi18 is a cracked yard with no lane marks where the real road is a three-lane carriageway; zi21 is still a bare sand plain under the camera with the tram poles beside it. Round 2 flagged both as missing roads; they are not worse, only restated. | sure (not new) |

What I looked for and did not find, so you do not have to look again: a yard where a real pavement or square should be in the old town (the Quattro Canti, Teatro Massimo, Politeama, Pretoria and Vucciria shots all kept slabs); a wall where the photo shows an obvious fence at su44, su41 or su38 (the walls there are plausible, su44 keeps its iron railing); a facade that reads wrong because of the new styles at Via Notarbartolo, Via Crispi and Via Cavour (the post-war blocks and old fronts both look right for their streets). The walls I distrust are on the faster roads only (mo25, mo26), plus po27.

## What is still most wrong, ranked by how much a Palermitan would notice

Size guesses as in round 2: small is a tuning change, medium is a few days of a lane, big is new models or a data pass. File names are guesses from reading the source, not a check.

1. **Tree look and species.** po09, po10, zi08, su13, su18, pt10, pt11, pe32, ce12, su08, su09, lm14. Avenues now close over the road, but the crowns are flat plates on identical trunks. Photos have stone pines in long tunnels along Viale Regione Siciliana (su08, su09: still one lone tree), holm oak over Viale Diana, bare winter planes, ficus over walls (pt12, ce15). Park ground is still lime lawn at Palazzina Cinese (xfa_0). Size: big. Files: `src/treegeo.js`, `src/species.js`, street tree placement in `src/world.js`.
2. **Outskirts with no buildings.** su02, su24, su26, su17, su44, lm18 to lm22, lm26, zi21, su29. The yards replaced the slab plains and the plain is now the colour of a car park, but the buildings are still not there: open ground, a roundabout without its island, blocks far away. Size: big. Files: `tools/footprints.py`, `tools/tiles.py`.
3. **Road wear still reads as holes.** lm09 (a bowl with a rim in the foreground), su45 (a big pit), xmo_1 (a dark octagon in the piazza), zi06, pt24 (a puddle hole), su13, xcp_0. Fewer and paler than round 2, but a few still read as craters. Size: small. File: `src/roadwear.js`.
4. **Motorway-grade roads are ordinary roads.** zi15, zi17, po25, su09, su10, lm19 to lm23, mo25. Still no double steel guard rails, solid edge lines or gantries. Size: medium. Files: `tools/tiles.py` (road classes), `src/fences.js`, `src/fence-walls.js` (do not turn a rail on a fast road into a wall).
5. **Missing road or wrong surface under the player.** zi21 (bare sand plain), zi18 (no carriageway), su17 (floating slab, explained in `outskirts.md`), su24 (slab), su29 (the flyover is a brown slab with no road on it), pt14 (no flyover). Size: medium. Files: `tools/road_surfaces.py`, `src/bridges.js`.
6. **Old-town facade character, the remaining part.** The ground floors and balconies are much better, but whole faces are still flat: the left side of ce22, ce09, ce15 (a long plain slab), xsd_0 (a huge buff wall with courses), su43 (a long blank factory-like front). The torn-patch decal repeats. Size: medium. Files: `src/buildings.js`, `src/wall-tex.js`.
7. **Pellegrino from the seafront and the hairpin.** yp_0 now shows a small pale crag behind the trees, pt01 to pt05 hide it in tree crowns; the photos have it as the skyline. pe08 (Via Pietro Bonanno) is still a huge pale vertical slab next to a better-looking mountain. Size: small to medium. Files: `src/world.js` terrain, `tools/terrain_check.py`.
8. **Street life patchy.** Parked rows are missing at pe21, zi20, su43, mo05, po01; no cafe tables or planters on Via Maqueda (ce04, ce27); no petrol stations (po19, su07), mast-arm traffic lights (lm26, po31). The Capo (xcp_0) and Vucciria still look like markets. Size: small to medium. Files: `src/props.js`, `src/markets.js`.
9. **Walls too tall or too plain on fast roads and plain facades.** mo25, mo26, su19 (left), po27, pe31. Size: small. These are mapped walls (checked at mo25, mo26 and po27 with `?nostreetwalls`), so the fix belongs where mapped walls are built, `src/fences.js`, not in `src/fence-walls.js`.
10. **Corso dei Mille has no tram** (su04), a toy-ball shrub fills the lens there; shrubs elsewhere are spheres (su07, su10, lm23). Size: small. Files: `tools/tram.py`, `src/trams.js`, shrub model in `src/props.js`.

Others still open from round 2, not in the top ten: tan verges (po22, su41, su45, su10, zi21, but gone at zi09, mo12), Via Guglielmo il Buono without its stone wall (ce15), the Barbera park wall (lm01 shows sand), the hedge at po08, SUCA tag on a facade at ce27, bunting strings at ce15 and the cathedral sheet.

Round 2's ranked list, status now (judged by the picture): 1 trees partly fixed; 2 outskirts still there; 3 old-town facades partly fixed; 4 Pellegrino from the seafront partly fixed; 5 road wear decals partly fixed; 6 motorway roads still there; 7 holes and wrong surfaces partly fixed; 8 Via Pietro Bonanno still there; 9 street life partly fixed; 10 tan verges partly fixed; 11 Corso dei Mille tram still there; 12 thin palms partly fixed; 13 Guglielmo il Buono partly fixed (a tree now, no wall); 14 underpass and flyover still there; 15 Viale del Fante still there; 16 boulevard hedges still there; 17 bunting and tags still there.

## Things I could not judge

ce01, ce02 and ce01_p (under a cafe awning: judged from the xqc crossing shots instead), ce03 (camera against a wall, the photo is a close-up of paving), ce18, mo09, su01 and po24 (camera inside or against a wall), po11 and ce37 (roadworks hoardings), the pano crops mo06, mo07, mo18, su26 (a stretched crop, no view of the roundabout), and xvu_0 (the Mapillary photo is a night shot of Vucciria, not comparable). ZEN, Porta Nuova, La Zisa, Santuario and Castello Utveggio, and Mondello pier were again not comparable for lack of a photo or a usable view; the game-only views of ZEN (gze_0 to gze_3) and Porta Nuova (hpn_*) look plausible for the place and are judged from knowledge, not a picture. No extra Mapillary photo was fetched. A photo near the Foro Italico looking at Monte Pellegrino across the park would help a later round, but I did not fetch one.

## Re-running this round

`tools/faith_round.sh [ROUND_DIR] [PORT]` does the whole thing: snapshots HEAD, downloads the photos (token from `data/mapillary_token`), serves the snapshot, shoots every viewpoint on one teleporting page and builds the contact sheets. For round 3 I ran the same steps by hand: copied `ref/` and `meta/` from round 2, `git archive HEAD` into `ROUND_DIR/game`, served it, ran `tools/faith_shoot.mjs --settle 4500` (the default settle of 1500 ms is too short: low-detail ground shows) through the shared browser slots, then `tools/faith_sheet.py` three times (main, `--only x`, `--grid`). The shoot script needs `tools/build/node_modules` (puppeteer-core), which a fresh worktree does not have; I linked the main checkout's folder, which is gitignored. Photos and sheets land in `ROUND_DIR`, outside the repo.
