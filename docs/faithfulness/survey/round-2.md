# Faithfulness survey, round 2: the game against Mapillary photos, again

Date: 2 November 2026. Game commit shot: 3f47ff8 (a snapshot of the committed tree, so other people's edits did not change the round halfway). Reviewer: one pass, no fixes made. Nothing here is copied from a photo; the photos were only looked at and live outside the repo.

## What was compared

- **138 pairs** at the survey viewpoints that had a Mapillary photo in round 1 (`mapillary.json`). The game camera was put at the photo's own position and heading (read from the Mapillary API), 1.6 m up, 60 degrees vertical fov, 11:00, UI hidden, car hidden, 1024 by 768. Round 1 shot from the survey viewpoint instead, which is up to 50 m from where the photo was taken, so some pairs are closer than before.
- **17 more photo pairs** at important places the survey had no photo for: Quattro Canti crossing (3), Teatro Massimo piazza (2), Politeama (2), Mondello piazza (2), Piazza Pretoria, Via Roma at San Domenico, Vucciria, Mercato del Capo, Stazione Centrale, Barbera exterior, Santuario road, Palazzo Favorita. These were found by a Mapillary radius search. Several are poor matches (the photo does not show the landmark); those are noted below. No photo was found for Porta Nuova, ZEN or La Zisa.
- **25 game-only views** with no photo (judged from knowledge of the real place, so weaker evidence): Cattedrale, Palazzo dei Normanni, Porta Nuova and Teatro Massimo from stand-off positions 6 m up, Vucciria and ZEN in four headings, and three extra headings at the Foro Italico to check the Pellegrino skyline.
- Sheets used: 23 survey sheets (6 pairs each), 3 extra-place sheets, 5 game-only sheets: about 35 image reads in total, since a few game-only sheets were rebuilt.

Caveats. Photos are 0.1 to 12 years old (median 7); I did not count roadworks hoardings (Via Crispi, Via Venti Settembre, Foro Italico) as defects. A phone's compass heading is not always right (ce10 is the clear case: the game frame looks a few tens of degrees away from the photo). Where the game camera ended up inside a wall or an alley (ce18, mo09, su01, po24) the pair is marked can't tell. Walking sprites sometimes stand in front of the lens. The panorama pairs (mo06, mo07, mo18, mo21, mo22, su09, su37) are plain crops of an equirectangular picture and are slightly stretched.

## Counts

Old high findings in `mapillary.md` (147, counting the five "at the photo position" extras), each checked against the new shot:

| status | count |
|---|---|
| fixed | 36 |
| partly fixed | 30 |
| still there | 69 |
| can't tell (no usable view, temporary object, camera in a wall) | 12 |

The old top 30 ranked problems, same test: 5 fixed (Quattro Canti, tram line, Via Maqueda surface, Cattedrale, Monte Grifone and Falsomiele cliffs), 10 partly fixed, 14 still there, 1 can't tell (the city gates at pt02).

Fixed or clearly better, from what I saw:
- Quattro Canti now reads: from the crossing (xqc_0 to xqc_2) there are concave baroque fronts with a fountain, niches with statues, columns, lamps. The earlier "blank buff wall" is gone.
- Cattedrale (hca_S): crenellated front, pointed arches, ribbed dome, clock tower. Teatro Massimo (htm_F): portico, steps, dome. Palazzo dei Normanni (hno_E, hno_N): the long arcaded front and the tower. These were the three big landmark complaints.
- Via Maqueda (ce04, ce05, ce27) is asphalt with kerbs and pavements, no longer a paved plaza.
- The tram line with black railing, red catenary poles and wires is there on Viale Leonardo da Vinci (zi05, zi06, zi07), Via Notarbartolo (po22, po23), Viale Regione Siciliana at zi19 and zi21, and the Circonvallazione (lm24). Only Corso dei Mille (su04) still has none.
- Foro Italico (pt01 to pt05): palm avenue, kerbs, pedestrian crossing, parked cars; the 15 m tan bands are gone.
- Parked cars now line the kerbs in a good share of the streets (po09, po10, po19, po31, pe29, su12, zi07, zi08, pt26, ce34). Round 1 had them almost nowhere.
- Garden and retaining walls exist now: Mondello (mo02, mo05, mo26), Via Vergine Maria and Papa Sergio (pe21, pe22, pe23, pe29), Lungomare Colombo (pe14, pe16), Via Pietro Bonanno parapet (pe06), the Normanni bastion (ce12), Falsomiele (su19), concrete wall at zi33.
- The white limestone cliff closes Via Nostra Donna del Rotolo (pe31) and the grey scrubby slope is behind Via Falsomiele (su19).
- Vucciria (gvu_0 to gvu_3) has striped awnings, stalls and crowds, so it reads as a market. The pale 10 to 20 m aprons beside streets are mostly gone outside a few places listed below.

## Old high findings, one by one

| id | layer | old finding (shortened) | status now |
|---|---|---|---|
| ce01 | landmarks | Quattro Canti is unrecognisable at the viewpoint: real view is the open octagon with two huge b... | fixed (crossing seen in xqc_0 to xqc_2: concave fronts, fountain, niches, lamps) |
| ce01_p | landmarks | At the crossing itself the game still shows no octagon: a blank buff wall with a red awning at... | can't tell (photo spot is 20 m north under a cafe awning, no facade in frame) |
| ce02 | landmarks | Same as ce01. | fixed |
| ce04 | pavements | Real street is an asphalt road with a white edge line and dashed lane marks, narrow stone pavem... | fixed (asphalt, kerbs, pavements now; no cafe terraces or lane lines) |
| ce05 | pavements | Real: asphalt road with dashed centre line and stone kerbs, pedestrians walking in the road; ga... | fixed |
| ce09 | pavements | Real street is a 9 m asphalt road with a white centre line, shop terraces and pedestrians; game... | still there |
| ce09_p | pavements | The game ground here is a tan terrain-tint plain instead of an asphalt road with a centre line,... | still there |
| ce10 | landmarks | Game cathedral side is a flat buff wall with pointed lancet windows and a battlement; the real... | fixed (ribbed dome, clock tower, arched front seen from the south (hca_S)) |
| ce10_p | landmarks | Cathedral is present with the right overall layout (battlemented wall, a square tower at the le... | fixed |
| ce12 | vegetation | Real roadside has stone pines, bare planes and a palm; game has lime lawn with spruce cones and... | still there |
| ce12 | walls, gardens, fences | The long bastion wall of the palace on the right (grey-ochre, 8 m high, sloping base) is missin... | fixed (long ochre bastion wall now on the right) |
| ce12_p | walls, gardens, fences | The 8 m high palace bastion wall along the right of the road is absent; the game shows open law... | fixed |
| ce12_p | vegetation | Spruce cones at the horizon instead of stone pines, bare planes and a palm. | still there |
| ce15 | vegetation | Real left side is a tall dressed-stone retaining wall under big ficus and holm oak; game has a... | still there |
| ce15 | walls, gardens, fences | The retaining wall is replaced by building massing; the upper palazzo set back behind the wall... | still there |
| ce16 | facade style and colou | Real lane is an old-town alley: arched wooden doors, wrought-iron balcony canopies, cream and o... | still there |
| ce18 | facade style and colou | Real alley is a 4 m canyon of weathered terracotta and ochre plaster with a dark painted skirt,... | can't tell (camera is inside a wall) |
| ce22 | facade style and colou | Real street walls are 5 storey baroque palazzi with deep wrought-iron balconies on carved stone... | still there |
| ce27 | pavements | Real street is asphalt with a white edge line, a stone kerb and terracotta planters; game paves... | fixed |
| ce32 | pavements | Game has a big tan sand patch on the left of the carriageway and a long skid rectangle; real ha... | fixed |
| ce32 | street furniture, prop | Real street is full of moving and parked cars and shop awnings with stalls at the kerb; game ha... | partly fixed |
| po01 | street furniture, prop | Real street has cars parked on both kerbs, bikes, dustbins and a yellow edge line; game has an... | partly fixed |
| po02 | vegetation | Real avenue is a continuous canopy of plane and jacaranda trees along both sides of Via Ruggero... | still there |
| po08 | walls, gardens, fences | Real left side is a tall dark-green iron railing on a stone plinth along a garden, with leaves... | still there |
| po11 | pavements | Real right side is a continuous construction hoarding with concrete barriers and billboards; ga... | can't tell |
| po12 | road layout, width, ma | Real road is a narrow one-way service lane (about 6 m) with parked cars along the kerb, running... | partly fixed |
| po18 | street furniture, prop | Real street is lined with cars on both kerbs, motorbikes and a speed-limit sign; game has a yel... | partly fixed |
| po19 | street furniture, prop | Real has parked cars along both sides in a continuous row, an ESSO station with a red canopy an... | partly fixed |
| po22 | street furniture, prop | Real street has an iron-railed tram median with overhead wires, queued cars, and a hedge and tr... | fixed (tram railing and wires now) |
| po23 | street furniture, prop | Real left side is a black iron railing on a concrete plinth guarding the tram line, with overhe... | fixed |
| po24 | street furniture, prop | Real has an Osteria sign, an Italian flag on the palazzo, shop fronts at street level, scooters... | still there |
| po25 | road layout, width, ma | Real road is a motorway-grade carriageway with double steel guard rails on both sides, a hatche... | still there |
| po27 | vegetation | Real left is a median planted with large ficus and broadleaf trees, right side has parked cars... | still there |
| po27 | street furniture, prop | Cars parked bumper to bumper on the right kerb, a cafe terrace with awning: missing. | can't tell |
| po31 | vegetation | Real avenue has big plane trees overhanging both kerbs, a palm and a stone-pine row; game has b... | still there |
| po31 | street furniture, prop | Cars parked on the right kerb with blue-line bays, traffic lights on mast arms, a road sign: mi... | partly fixed |
| po34 | walls, gardens, fences | Real right side is a 5 m transparent and black noise barrier on a raised ramp with a guard rail... | still there |
| mo01 | walls, gardens, fences | Real left side is a continuous plastered garden wall with villas, palms and parked cars behind... | partly fixed |
| mo02 | walls, gardens, fences | Real left is a white plastered wall with a gate, tropical shrubs over it and parked cars; game... | fixed |
| mo05 | walls, gardens, fences | Real right side is a dense tall hedge and tree wall behind a kerb, left side has parked SUVs al... | partly fixed |
| mo06 | walls, gardens, fences | Real street is a 6 m lane between plaster garden walls and hedges under mature stone pines and... | can't tell |
| mo09 | vegetation | Game fills the roadside with a grove of fat, 15 m tall palm trunks with spiky crowns; real road... | can't tell (camera is inside an alley or wall, photo not comparable) |
| mo09 | walls, gardens, fences | Real left side is a rubble stone retaining wall topped with an iron fence and a villa garden; g... | can't tell |
| mo12 | pavements | Real road runs straight between garden walls and hedges with trees overhead, asphalt to the ker... | fixed |
| mo12 | walls, gardens, fences | Garden walls, plaster fences, tree canopy and a parked car row missing. | partly fixed |
| mo18 | walls, gardens, fences | Real lane is hemmed by a rubble wall topped with a diamond mesh fence on the right and a villa... | can't tell |
| mo20 | walls, gardens, fences | Real right side is villa gardens with a brick or stone wall, gates and cypress; game has a pale... | partly fixed |
| mo23 | walls, gardens, fences | Real right side is a tall stone gate pier with iron gate and a long wall; left has a plaster vi... | partly fixed |
| mo25 | road layout, width, ma | Real road at this point is a motorway-grade ramp towards the A19/A20 with steel crash barriers... | still there |
| mo26 | vegetation | A single huge spruce cone stands beside the road; real roadside is broadleaf trees, olive and b... | still there |
| pe06 | walls, gardens, fences | Real road has a continuous 0.8 m dry-stone parapet on the valley side and a rock cut with grass... | fixed |
| pe06 | vegetation | Real slope is dry grass tufts, shrubs and a few Aleppo pines; game has 20 m tall spruce cones a... | partly fixed |
| pe08 | terrain | Real hairpin runs under an overhanging ochre limestone cliff with rock outcrops and a grassy ve... | still there (camera faces a huge pale vertical slab) |
| pe13 | walls, gardens, fences | Real left side is hedge-covered garden walls with iron gates and villas; game has a wide pale p... | partly fixed |
| pe14 | walls, gardens, fences | Real left is a plaster and brick wall with a decorative iron gate, bougainvillea and oleander a... | fixed |
| pe14 | pavements | The pale paved slope at the foot of the cliff replaces the real rock face with scrub. | fixed |
| pe15 | walls, gardens, fences | Real right side is a tall rubble stone retaining wall with a mesh fence; sea side has a steel c... | still there |
| pe16 | walls, gardens, fences | Real right side is a white stone-clad garden wall topped by a clipped hedge and trees; game has... | fixed |
| pe19 | walls, gardens, fences | Real lane is 4 to 5 m between an oleander hedge with grass verge (left) and a retaining wall wi... | still there |
| pe19 | vegetation | Oleander in flower and Aleppo pine umbrellas missing. | still there |
| pe21 | walls, gardens, fences | Real right side is a continuous 3 m masonry wall (long, stuccoed) with cypress behind; game has... | fixed |
| pe21 | street furniture, prop | Cars parked bumper to bumper on both kerbs; game has none. | still there |
| pe22 | walls, gardens, fences | Same long tall wall and plane trees in the real photo; game shows sand bands, a pale pavement a... | fixed |
| pe23 | walls, gardens, fences | Real right side is a 3 m ashlar stone wall with oleander and cypress behind, left has plaster w... | fixed |
| pe29 | street furniture, prop | Real street has cars parked along both kerbs, nose to tail; game has two dumpsters and an empty... | fixed |
| pe31 | terrain | Real street frames the grey limestone wall of Monte Pellegrino at the end of the street; game v... | fixed (white limestone cliff now closes the street) |
| pe31 | walls, gardens, fences | Real right side is a low stone wall with a mesh fence and a reed thicket; left has fences and g... | partly fixed |
| pe32 | vegetation | Real avenue is a tunnel of mature broadleaf oaks and poplars with dry grass and orchard trees b... | still there |
| zi05 | street furniture, prop | Real avenue has a tram line behind a black iron railing with red overhead-wire poles, tram stop... | fixed |
| zi07 | street furniture, prop | Real central reservation carries a tram line with red overhead poles, a black iron railing, and... | fixed |
| zi08 | vegetation | Real avenue has a double row of mature plane trees on both sides and a hedge strip; game has no... | still there |
| zi09 | vegetation | Real roadside has plane trees, a stone pine and a palm; game has bare sand and tan paving. | still there |
| zi09 | pavements | Game road sits on a 10 to 15 m wide tan band and blank pale apron; real asphalt runs straight t... | partly fixed |
| zi15 | road layout, width, ma | Real is a 3 lane motorway-grade carriageway with continuous steel guard rails, solid white edge... | still there |
| zi16 | road layout, width, ma | Real is a 3 lane carriageway with solid edge lines, steel guard rails both sides, tufted scrub... | partly fixed |
| zi17 | road layout, width, ma | Real is a curving expressway ramp with a guard rail, grass verge, a big stone pine and heavy tr... | still there |
| zi18 | pavements | Real road is a 3 lane carriageway with a concrete retaining wall and railings on the right and... | still there (camera now stands on stone paving, still no carriageway) |
| zi18 | road layout, width, ma | The tram viaduct wall and guard rail are absent. | still there |
| zi19 | street furniture, prop | Real central reservation carries a tram line with red overhead-wire poles, iron railings and si... | fixed |
| zi20 | street furniture, prop | Real street is packed with cars parked double-deep on both sides, shop awnings and a tabacchi s... | still there |
| zi21 | street furniture, prop | Real left side is a tram line with iron fence and red poles; right has a white noise barrier on... | partly fixed |
| zi21 | vegetation | Giant ficus canopy over the road is missing. | still there (big bare sand plain under the camera) |
| zi28 | walls, gardens, fences | Real lane runs between iron-railed walls and a green mesh fence with a stone-and-concrete gate... | fixed |
| zi28 | vegetation | Eucalyptus avenue and shrubs missing. | still there |
| zi28 | building heights and m | Real road has fenced gardens and villas on both sides; game has empty ground (missing buildings... | still there |
| zi31 | street furniture, prop | Real street has cars parked bumper to bumper on both kerbs; game has none. | partly fixed |
| zi33 | walls, gardens, fences | Real right side is a 3 m precast concrete wall with a rusty spiked fence on top, left is a scru... | fixed |
| su01 | street furniture, prop | Real street is a busy shopping street with parked scooters, cars both sides and shop signs in r... | can't tell |
| su02 | building heights and m | Real junction is a busy street with market stalls under white awnings, 5 to 8 storey blocks on... | still there |
| su04 | street furniture, prop | Real central reservation has a tram line with red overhead poles and decorative iron railings,... | still there |
| su05 | street furniture, prop | Cars parked along both kerbs, shop awnings and a person at the kerb; game has none, only an emp... | partly fixed |
| su06 | street furniture, prop | Real street has cars parked on both kerbs, a dumpster, shop shutters and laundry hung on balcon... | partly fixed |
| su07 | street furniture, prop | Real roadside has an IP petrol station with canopy and price sign, billboards and arching lamp... | still there |
| su08 | vegetation | Real road runs under a continuous tunnel of stone pines (umbrella crowns, 15 m) next to a steel... | still there |
| su09 | vegetation | Real road has a long row of stone pines and palms on a planted median with a steel guard rail a... | still there |
| su09 | road layout, width, ma | Median with guard rail and lamp posts missing; game has a flat single carriageway. | still there |
| su10 | road layout, width, ma | Real is a raised expressway with double steel guard rails, mesh fence and tall twin-arm lamps n... | still there |
| su11 | street furniture, prop | Real street has cars parked nose to tail on both kerbs and a central strip with shrubs; game ha... | partly fixed |
| su12 | street furniture, prop | Real side street has cars parked along both kerbs and graffiti-covered wheelie bins; game has o... | fixed |
| su13 | vegetation | Real avenue has a long row of pollarded plane trees on both kerbs; game has none. | still there |
| su16 | pavements | Real junction is clean asphalt with kerbs and recycling bins; game has a tan terrain plain with... | partly fixed |
| su17 | walls, gardens, fences | Real lane runs beside a 2 m concrete wall with a plaque, reeds, stone pines and cypresses; game... | still there |
| su17 | vegetation | Reeds, pines and cypress missing. | still there |
| su17 | pavements | Game has 20 m of pale paving beside a 6 m road; real is a lane with a walled edge. | still there (also a floating grey slab artefact) |
| su18 | vegetation | Real street is an avenue of broadleaf trees with a canopy over the road and recycling bins; gam... | still there |
| su18 | building heights and m | Real street is enclosed by houses and walls; game has open ground. | still there |
| su19 | walls, gardens, fences | Real lane is a 3.5 m strip between a whitewashed rubble wall (left) and a dry-stone terrace wal... | partly fixed |
| su19 | terrain | Real mountain is a steep grey limestone face with green scrub terraces; game slope is a smooth... | fixed |
| su24 | building heights and m | Real junction is a rural village edge with 1 to 2 storey houses behind rubble and plaster walls... | still there |
| su24 | walls, gardens, fences | Whitewashed and rubble garden walls, an iron gate and road signs missing. | still there |
| su26 | road layout, width, ma | Real is a landscaped roundabout with kerbed island, shrubs, give-way and roundabout signs, a lo... | still there |
| su26 | building heights and m | Real horizon has a fenced industrial yard, tank, and a railway embankment with overhead wires;... | can't tell |
| su29 | road layout, width, ma | Real is an elevated viaduct with concrete parapet, lamp posts and trucks; game is a road across... | partly fixed (game has a flyover now but the camera is on the ground under it, photo is on the deck) |
| su34 | walls, gardens, fences | Real lane is hemmed by a 4 m rough ashlar wall on the right with weeds and a plastered farmhous... | still there |
| su38 | walls, gardens, fences | Real lane has 2 m plastered garden walls with gates and a row of parked cars under trees; game... | partly fixed |
| su39 | walls, gardens, fences | Real left side is a long rubble stone wall with a wrought-iron fence and a stone pine; game has... | partly fixed |
| su41 | walls, gardens, fences | Real left side is a 2 m orange works hoarding and a wall with an iron gate; right has cars park... | can't tell |
| su43 | street furniture, prop | Real street has cars on both kerbs, a stepped brick pavement and balcony plants; game has an un... | still there |
| su44 | walls, gardens, fences | Real road runs between a ruined ashlar farmhouse wall (right) and a guard rail with dense Medit... | still there |
| su44 | building heights and m | Real tall rough-cut stone ruin and tree canopy missing; confirms the south coast plain finding. | still there |
| su45 | vegetation | Real roadside has eucalyptus, birches and bamboo; game has bare ochre ground with sparse traffi... | still there |
| pt01 | vegetation | Real seafront has tall Washingtonia and Phoenix palms and big clipped pittosporum hedges; game... | fixed (palm avenue now, tan bands gone) |
| pt02 | landmarks | Real view ends at a neoclassical colonnaded gateway with a lion-topped pediment (Porta dei Grec... | can't tell |
| pt03 | vegetation | Date palms in groups, shrubs and a stand of pines are replaced by spruce cones and ball trees. | fixed |
| pt03 | pavements | Game road sits on 15 m sand bands left and right; real road has a kerb and pavement with a stal... | fixed |
| pt04 | vegetation | Real left has a fence with orange netting (works) and tall Washingtonia palms plus a stone balu... | fixed |
| pt04 | coastline and sea | No balustrade or sea wall in the game; the real right side has a stone balustrade with posts. | still there |
| pt10 | vegetation | Real street is shaded by big plane and ficus trees with a row of cars parked along the blue-lin... | still there |
| pt10 | street furniture, prop | Parked cars and bay lines missing, a yellow bus fills the foreground. | partly fixed |
| pt11 | pavements | Game puts the camera on a 20 m wide pale plaza with a thin asphalt strip, where the real street... | fixed |
| pt11 | street furniture, prop | Cars parked on both sides missing. | partly fixed |
| pt12 | vegetation | Real street is shaded by a huge ficus canopy overhanging a stone garden wall; game has no trees... | still there |
| pt12 | street furniture, prop | Cars are parked on both kerbs in the real street, with blue bay lines; game has an empty road. | partly fixed |
| pt14 | road hidden by terrain | Real roadway dips under a concrete flyover with retaining walls and a bike barrier; the game ha... | still there |
| pt19 | vegetation | Real has tall Washingtonia palms, flowering oleander and a big ficus along a parking-lined seaf... | partly fixed |
| pt24 | facade style and colou | Real left building is a 1950s concrete block with a deep pilotis arcade, shuttered balconies an... | still there |
| lm01 | vegetation | Real roadside is a plaster park wall with flowering Judas trees and stone pines; game has a law... | still there |
| lm14 | vegetation | Real roundabout edge has dense stone pines, holm oaks and a clipped hedge; game has spruce cone... | still there |
| lm18 | building heights and m | Real street has low 2 to 3 storey old houses, a tile roof factory building and a ficus; game ha... | still there |
| lm19 | road layout, width, ma | Real is a dual carriageway with steel guard rails, an edge line and exit signs, a rust-coloured... | still there |
| lm20 | road layout, width, ma | Real is a 3 lane motorway carriageway with steel guard rails both sides, rumble strips, billboa... | still there |
| lm21 | road layout, width, ma | Real motorway has guard rails on both sides and 3 lanes with a hatched shoulder, scrub verges a... | still there |
| lm22 | road layout, width, ma | Real is a 3 lane carriageway with double steel guard rails each side, green gantry sign and dis... | still there |
| lm23 | road layout, width, ma | Real is a motorway-grade ring road with steel guard rails, green exit signs on a gantry, scrub... | still there |
| lm24 | street furniture, prop | Real road carries a tram catenary on red poles, a metal fence, a yellow recycling bin, parked c... | fixed |
| lm26 | street furniture, prop | Real street has cars parked at the kerb, flags of a dealership, traffic lights, a billboard and... | still there |
| lm26 | building heights and m | Real street is lined by 4 to 6 storey blocks and a pine grove; game has a big empty plaza and l... | still there |

## What is still most wrong, ranked by how much a Palermitan would notice

Size guesses: small is a tuning change or one rule, medium is a few days of a lane, big is new models or a new data pass. File names are my best guess from reading the source, not a check.

1. **Trees, everywhere.** ce12, po02, po08, po09, zi08, zi09, su08, su09, su13, su18, pe32, pt10, pt12, lm01, lm14, mo26, pe19. Game: the low-poly ball and umbrella trees stand one by one, each a faceted blob, and no canopy ever closes over a road; park ground is lime lawn (pe32, xfa_0). Photos: plane rows with open crowns (Via della Liberta, Michelangelo, Basile), a tunnel of holm oak over Viale Diana, stone pines along Viale Regione Siciliana, ficus overhanging walls (pt12). The species code already exists (planes, ficus, stone pine in `src/species.js`), so the gap is the look of the models and the density along avenues, not the mix. Size: big. Files: `src/treegeo.js`, `src/species.js`, the street tree placement in `src/world.js` and `tools/green.py`.
2. **Outskirts with no buildings.** su02 (Via Oreto), su18, su24, su26, su44, lm26, su17. Game: open plain with two or three blocks far away, a roundabout without its island, an empty ground where the photo shows 5 to 8 storey blocks, stalls, fenced yards. Photo: continuous street walls. Size: big. Files: `tools/footprints.py`, `tools/tiles.py` (fill of missing footprints), possibly `src/buildings.js` for infill blocks.
3. **Old-town facade character.** ce15, ce16, ce22, po24, su43, zi31, pt24, xsc_0. Game: flat buff or ochre walls, rows of identical roller shutters and louvred windows, the same ground floor everywhere; a whole block of equal windows in xsc_0. Photos: arched wooden doors, wrought-iron balcony canopies on stone brackets, plaster in terracotta, ochre, cream and salmon, awnings, plants, laundry. Size: big. Files: `src/buildings.js`, `src/wall-tex.js`, `tools/colours.py`, `tools/facade_photos.py`.
4. **Monte Pellegrino disappears from the seafront.** yp_0 and pt01 to pt05: from the Foro Italico looking north the mountain is a faint grey hint at the horizon, in the photo (pt01, pt04) it is the whole skyline. In land shots further inland (zi06, lm19, su19) the mountains are clear, so this looks like haze or the far terrain rather than a missing mountain; I did not test which. Size: small to medium. Files: fog and horizon in `src/daynight.js` and `src/main.js` (`scene.fog`), far terrain in `src/world.js`.
5. **Road wear decals read as holes.** ce12, ce27, lm09, lm14, mo17, mo21, pt02, pt24, su34, su38, su45, su16, su13, zi06, zi09, xmo_1 and gzi_2, gzi_3. Game: black hexagonal pits 2 to 4 m wide, blue puddles at 11:00, long curved skid arcs and crack lines, five to ten per street, also on mountain roads (pe06). Photos: worn but even asphalt with the odd manhole. Size: small. File: `src/roadwear.js` (size, count and contrast of potholes, puddles and skids).
6. **Motorway-grade roads are ordinary roads.** po25, zi15, zi17, su07, su09, su10, lm19 to lm23, mo25. Game: two lanes, dashed centre line, at best a low wall or a barrier on one side (zi16) and lamp masts. Photos: double steel guard rails, solid edge lines, hard shoulder, gantry signs, three lanes. Size: medium. Files: `tools/tiles.py` (road classes), `src/fences.js` (rails), `tools/medians.py`.
7. **Holes and wrong surfaces in the road layer.** zi18: the camera stands on stone paving with no carriageway (round 1: bare ground). zi21: bare sand plain under the camera, tram poles beside it, the road missing. su17: a pale plaza and a floating grey slab (an artefact) where the photo has a 4 m lane. ce09, ce16, su24, zi19: wide stone paving where the photo shows asphalt. Size: medium. Files: `tools/road_surfaces.py`, the terrain bench shaping in `tools/tiles.py`, `src/bridges.js` for the Viale Regione Siciliana viaduct.
8. **Via Pietro Bonanno hairpin.** pe08: the camera faces a huge pale vertical slab, spiky terrain wedge; photo: an overhanging ochre limestone cliff with outcrops. pe06 next to it is much better (parapet, narrower road). Size: medium. Files: terrain shaping in `tools/terrain_check.py` and `tools/dem.py`, cliff texture in `src/world.js`.
9. **Street life patchy.** Parked rows are missing in pe21, zi20, su43, mo05, po01 (the photo has them both sides). No cafe tables, parasols or planters on Via Maqueda (ce04, ce27); no petrol stations (po19, su07), billboards, traffic lights on mast arms (lm26, po31). The Capo market (xcp_0) does show stalls and awnings now, which is right. Size: small to medium. Files: `src/props.js` (parked cars, furniture), `src/markets.js`.
10. **Tan verges next to the kerb.** zi09, zi28, zi33, su41, su13, po22, po23, su08, su10, pe19, pe31, pt24, lm23. Game: a 1 to 3 m sand-coloured strip beside the asphalt. The photo sometimes has bare earth there (su45), often a kerb and a pavement. Size: small. File: `tools/road_surfaces.py` or the ground tint in `tools/tiles.py`.
11. **Corso dei Mille has no tram** (su04) and no tram stops anywhere I looked. Size: small. Files: `tools/tram.py`, `src/trams.js`.
12. **Palms are thin.** pt01 to pt05, pt19, mo01: Washingtonia and Phoenix with a single bare trunk and a small umbrella crown, against full dense crowns in the photos. Size: small. File: `src/props.js` palm models.
13. **Via Guglielmo il Buono** (ce15): the dressed-stone retaining wall under big ficus is a plain five storey slab with no trees. Size: small. File: `src/fences.js`, tree placement.
14. **Underpass and flyover.** pt14: flat road, the concrete flyover is missing; su29: the game has a flyover now, but the photo is taken on the deck and our camera is under it, so the deck road is the open question. Size: medium. File: `src/bridges.js`.
15. **Viale del Fante and the Barbera** (lm01): sand ground where the photo has a plaster park wall, Judas trees and stone pines; the stadium front itself (xba_0) shows a pale pillared facade, but the photo there shows the street side with a fence, so the pair does not compare. Size: small. Files: `src/fences.js`, `src/stadium.js`.
16. **Boulevard hedges and railings.** po08: a flat-topped dark box hedge, the real railing on a plinth is missing. Size: small. File: `src/gardens.js`.
17. **Bunting and wall tags.** The SUCA tag (ce27) and bunting (gzi_3, gvu_1) still show up on facades; none of the photos at those places has them. Size: small. Files: `src/suca.js`, `src/buildings.js`.

Things I could not judge: ZEN (gze_0 to gze_3 are grey slab blocks around paving, which fits what I know of the place, but there is no photo); Porta Nuova and Porta Felice and Porta dei Greci (no usable view); Zisa (gzi_0 shows a crenellated block at the end of a street, plausible, no photo); the Santuario and Castello Utveggio (the spot coordinates put the camera inside rock, so no frame is usable; round 1 of the Pellegrino roads is still the best evidence); Mondello pier (not shot).

## Re-running this round

`tools/faith_round.sh [ROUND_DIR] [PORT]` does the whole thing: snapshots HEAD, downloads the photos (token from `data/mapillary_token`, sent as a header only), shoots every viewpoint on one teleporting page and builds the contact sheets. The scripts are `tools/mapillary_refs.py`, `tools/mapillary_extra.py` (places in `tools/faith_places.json`), `tools/faith_shoot.mjs` and `tools/faith_sheet.py`. Photos and sheets land in `ROUND_DIR`, outside the repo.
