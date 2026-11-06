# Buildings outside the centro: faithfulness notes

Pass 2 of the district work (zones, palettes, storeys, styles). Method: look at the real place (Google Maps satellite and Street View, for looking only; nothing
from Google is stored in the repo or the game), shoot the same viewpoint in the game with a free camera, list the differences, fix the biggest, shoot again.
Street View captures are May 2026 unless noted. In-game textures are all procedural, so no new credits were needed (`assets/CREDITS.md` unchanged).
Screenshots stay out of the repo (they live in `/private/tmp/bld/shots`, before and after sheets are named in the report).

Tools: `tools/district-view.html` (new `sunrel=1`: sun behind the camera, brighter exposure), `tools/district-shot.sh`, `tools/district-calibrate.mjs` (new, storey
histograms from lidar per zone), `?bdbg` on any page that builds buildings (`window.__bldDbg` lists id, zone, style, height and height source per building,
`window.__bldTris` triangles per style).

## What was compared, what was off, what changed

| Place (viewpoint) | Real (Street View) | Game before | Change |
| --- | --- | --- | --- |
| Via della Liberta at no. 83, looking west | 9 to 10 storey cream and grey block, stacked continuous balconies with thin metal rails, graffiti wall in front, plane trees; low 3 to 4 storey palazzine on the east side | same footprint drawn as a tan block with brown shutters, no balconies, no shops (see root cause below) | fronts set back behind a garden or lane now count as fronts, so balconies and shops appear; viaLib palette pale; `pw` almost gone from the belt |
| Viale Lazio 38 | 7 to 8 storey cream and white condos, protruding balconies in stacked columns with glass and aluminium rails, brown tapparelle, palms | 4 to 5 storey grey-beige slabs, small windows, no balconies | new `avenue` zone (7 to 11 storeys, a few 12 to 14) on Strasburgo, Notarbartolo, Lazio, Campania, Francia, Regione Siciliana, Leonardo da Vinci; `pal` buildings get half their bays as balcony columns, half of them with the new glass and aluminium rail (`rail_g`) |
| Via Olivio Sozzi (sacco grid) | 7 to 8 storey off-white blocks, balconies with solid soffits, narrow street | terracotta and orange heavy palette, shutters only | sacco palette mostly pale, `blk` 50 %, `pal` 22 %, `pw` 3 % |
| Viale Strasburgo 404 (blurred capture) | 9 storey yellow-ochre block with stacked balconies next to white ones | n/a | covered by `avenue` |
| Corso Calatafimi 468 | 4 to 5 storey 19th c palazzi, ochre and cream plaster, wrought-iron balconies, cafe and shops below | continuous-balcony postwar block style | new `calat` zone by street name (Calatafimi, Tukory, Pisani, 20 m): `n19` 50 % |
| Piazza Noce | 5 to 6 storey yellow-ochre and tan blocks, small windows, shops with yellow signs | dark brown, no shops | yellow palette, `pw` 28 % to 10 %, set-back fronts |
| Via Cruillas 113 and 313 | 2 to 3 storey old houses (ochre plaster, green shutters, dark wood doors, iron balconies on brackets) and, 150 m away, unfinished 1 to 2 storey self-built houses; 4 to 5 storey blocks around | seed was `cep` (public housing slabs) | new `cruillas` village zone; periph storeys recalibrated (below) |
| Via Primo Carnera 10 (ZEN) | sand-ochre and tan plastered blocks, open pilotis passages, garage doors, deep balcony slabs, laundry, A/C | grey concrete, grime 0.8, ground floors bricked up | sand-ochre palette, grime 0.55, ground floor pilotis and garage doors, insulae allowed from 110 m2 (was 300, so only 5 of 80 buildings qualified) |
| Piazza Acquasanta 14 | 3 storey tufa-ashlar and ochre palazzine, arched doors, wrought-iron balconies, green and dark wood doors | plain plaster `res` and `fish` | tufa stone palette, `pStone` 0.5, `n19` 30 %, `fish` 24 % to 10 % |
| Via dell'Arenella 1 | 4 to 5 storey cream and white blocks, continuous balconies, blue trim bands | `fish` 50 % | `pal` 26 %, `blk` 14 %, `n19` 12 %, `fish` 14 % |
| Via Sferracavallo 93 | 2 to 3 storey yellow-ochre and pale houses, flat roofs, pilotis porches, one blue-grey 8 storey tower | whitewash-heavy palette | ochre and yellow added to the palette, `blk` 8 % (the tower), `pw` 4 % |
| Via Tommaso Natale 80 | villas and low houses in walled gardens with pines | `pal` 34 % | `res` 42 %, `pal` 24 %, `lib` 6 % (the walls are not modelled, see below) |
| Via Mondello 34 | ochre and yellow villas with tile roofs, palms, walled gardens | already close | unchanged |
| Piazza Uditore 5 | 1 to 2 storey rendered and rubble-stone borgata, crumbling plaster, 5 to 6 storey condos behind | `pal` 38 %, `blk` 24 %, no 1 storey | `res` 28 %, 1 to 6 storey table, `pStone` 0.14 |
| Via Giulio Sarmiento (Brancaccio) | 4 to 6 storey cream and ochre blocks with stacked balconies, 3 storey terracotta-orange houses with tile roofs | `pw` 20 %, no orange | terracotta and orange plaster added, `pw` 6 %, `pal` 20 % |
| Via Oreto 343 | worn 4 storey corner houses beside 6 storey ochre blocks with balconies | `pw` 24 % | `blk` 30 %, `pw` 6 % |
| Via Anapo 69 (Bonagia) and Via Viperano (Resuttana) | 4 to 6 storey ochre condos with garages; 3 to 4 storey cream palazzine | would have become 1 to 2 storeys after the lidar recalibration | density rule keeps them tall (below) |
| Via Principe di Paterno 4 and Piazza Castelnuovo | 5 storey ochre-stone palazzi behind low stone walls and hedges; neoclassical corner palazzo with iron balconies | politeama and sacco already close | not changed; walls and gardens are a props job |

Not seen (Street View would not load, or only an indoor panorama): Politeama proper, Valdesi (open park at the viewpoint), Corso dei Mille (trees only), Fiera.
Their zones are unchanged apart from the shared fixes.

## Root causes found

1. **Set-back facades were treated as backs.** A wall only counted as a street front if a road edge lay within 3.2 m of the point 2.2 m in front of it.
   Along Via Liberta, in the ZEN and wherever there is a garden strip, service lane or parking row the facade stands 5 to 15 m back, so it got no shops, no
   balconies and the blank-wall ground floor. `emitSolid` now looks further out along the normal (every 4 m up to `Z.front`, default 15 m in the `elig` zones)
   and stops at the first building in the way. The centro zones are untouched (`reach` 0).
2. **`pw` has no balconies** and ignored the zone palette (it used the centro grey-beige list). In the new zones it now uses the zone palette, and its weight was cut
   in all postwar zones (nearly every Palermo condo has balconies; `blk` and `pal` have them).
3. **Generic storeys were 1 to 2 floors too tall outside the dense belts, and tiny buildings kept the baked 3 to 6 floors.** Lidar covers only the east half of
   the city; for the lidar-covered parts of periph, rural and tn the measured storey histogram is 40 to 65 % one floor, 25 to 40 % two, under 10 % four or more,
   while the generic table gave a mean of 3.0. The generic buildings of those zones now use the measured histograms by footprint class (`flA`, produced by
   `tools/district-calibrate.mjs`, rerun it after a rebake), applied to buildings under 40 m2 as well (sheds and garages, one storey). Dense pockets of large
   footprints inside those zones (45 m neighbour count and footprint size, edge-corrected per tile) take a 3 to 7 storey block table instead, which keeps
   Bonagia and Resuttana right. Net effect on the 18k generic periph buildings: 46 % one floor, 29 % two, 13 % three, 12 % four or more.
4. **Colour.** Postwar belts were drawn in tan and terracotta; Street View shows cream, off-white and light grey-beige with ochre and orange as minorities. Zone
   palettes were rebalanced by repeating the pale entries (the picker is `b.c % length`).

## Unchanged by design

Lidar heights, OSM `building:levels`, named, church, historic and typed buildings (the generic-estimate detection rule in `applyDistrictHeights` is as before), the
photo facades and the landmark skip ids. A building near a street rule (avenue, calat, sacco) may take its storeys from the street zone's table; the others use the
choice `applyDistrictHeights` stored in `b.dz` and `b.dh`.

## Budget

Triangles of the 9-tile `district-view` sets before to after: Via Liberta 524k to 588k (+12 %), Viale Lazio 411k to 486k (+18 %), Via Sozzi 469k to 583k
(+24 %), Noce 499k to 546k (+9 %), Oreto +12 %, Corso dei Mille +13 %, ZEN 229k to 207k (-10 %), Tommaso Natale -5 %. The growth is the balconies and shop
fronts on set-back facades. Already trimmed: bracket count on continuous balconies, end caps on long slabs, `pal` balconies on every other bay. The mobile
`tricap` will demote the dense belt tiles slightly sooner than before.

## Not done, and problems outside this area

- Low boundary walls, hedges and front gardens (Via Principe di Paterno, Via Tommaso Natale, Mondello, Libertà side streets) are a big part of the real look; they
  belong in props or `world.js` (walls from OSM `barrier=wall` and the building setbacks).
- Sferracavallo's west half lies outside the baked bbox (lon < 13.285): Via Sferracavallo and the harbour are not in the world. The tile bake should extend west.
- The CEP and Borgo Nuovo seeds are still my best guess from names; I could not confirm their extents. Via Cruillas is now its own zone.
- Roofs: no new roof types. Real hillside houses have rebar stubs and unfinished top floors, not modelled.
- Ground: every street in the game has a raised paved sidewalk band (light grey slabs) even in villa suburbs and ZEN where the real street has none; that is the
  ground/streets agent's area.
- Free-camera shots of far districts need 40 s or more of streaming; `tools/shot.sh` (20 s) shows empty ground there.
- The headless Chrome and the shared in-app browser pane both made Street View slow (about 25 s per view); only 28 views were taken.

## Old-town facades (round 2, item 3)

Photos: ce16 (Via Porta di Castro), ce22 (Via Cavour), xsc_0, and the post-war avenues po24, zi31, su43, pt24. The game showed flat buff walls, one window type repeated down a whole facade, the same shuttered ground floor everywhere, balconies only on the piano nobile.

What `src/buildings.js` does now:

- **Layer groups.** `aLayer >= 200` names a group (`GRPV`: first layer, count) and the fragment shader picks one variant per bay and floor from a hash of `floor(vTileUv)`, so a facade shows many windows from one strip of two triangles and no extra geometry. Every wall starts at another bay (`B.uo`, added to the strip uvs). Groups: the old-town windows (`old_up`, `old_nob`, `old_top`, `old_wall`), old-town ground floors (`og_door`, `og_shop`, `og_low`), the plain street shop in four shutter states (`g_shops`, via `GMAP`), and the existing runs of window layers of every other style (`UPGRP`: blocks, plain houses, 19th c., Liberty, post-war), so blinds, awnings and shutters differ from flat to flat everywhere.
- **Old town** = `OLDZ` zones (corso, roma, old, centro, kalsa, alberg, politeama, stazione) and the styles bar, n19, res and low, without a per-building spec (the measured palaces keep their own look). A shared aged render (`obase`, one fixed seed, so bays and tiles meet without a seam), repair patches, stone surrounds with a recessed opening, dark painted skirts, a smaller top floor, arched wooden doors, passages (androne), a votive niche, small shops with wooden or metal shutters. Palette `OLD_PAL` (terracotta, salmon, ochre, cream, grey), a little desaturated. Per house: bay width x0.82 to 1.32, ground floor height +-12 %, storey height +-8 % (so the storey count can differ from the neighbour), cornice depth. `pw` is halved in these zones.
- **Balconies in runs** (`obalc`): one slab, one rail and triangle brackets per run of one to three bays, a long one on the piano nobile, on most floors. Cheaper per metre than a balcony per bay, so the old-town triangles went down (QC full-detail buildings 519k to 487k, Kalsa 402k to 384k).
- **Weathering in the shader**: repainted and damp patches and rain streaks from a tiling noise layer (`wxnoise`, two fetches). The first version computed value noise per pixel and cost 1.5 to 2 ms on the phone profile; the texture version is within noise.

**Round 5: why the big faces stayed flat, and the houses rule.** Round 4 found that the window surrounds, shutters and balconies above moved no finding on the biggest faces (ce22, ce16, ce15, ce04, ce27, su05, su01, xsd_0, xvu_0, ce03, ce08, ce18). What was tested, with a build that colours every wall by the kind it was given (street, party, back) and a dump of every wall of the old-town buildings (about 97,000 walls over 20 viewpoints in the centre, area-weighted by length times height):

- *A face read as side or back* is not the cause for faces on a road. Of the old-town wall area with a road edge within 5 m in front, 86 % is street, 12 % party and 1.5 % back. Overall only 26 % of old-town wall area is street (the rest are party walls of the dense block, and backs), which is why a flat face in a photo was so often a party or back wall: the facade rules only ever reached the street quarter. A back wall in front of an open space (Piazza San Domenico, xsd_0) was the exception: only `elig` zones looked past 3.2 m for a street, the centre zones did not. They now look 13 m (`reach`), stopping at the first building, like the others.
- *A building too long for its bay logic* is the cause. One OSM outline is often a whole block front: Via Cavour at ce22 is one wall of 72.8 m with one colour, one storey height, one window pitch and one cornice. Walls of 30 m and more are 26 % of the street area facing a road in the old town, 20 m and more 43 %. Real fronts of that length are several houses, each with its own colour, floor heights and balconies. That one slab is the shot.
- *Windows skipped on some storeys* is not it: every storey gets its strip. Balconies were thin, not missing: a house had a 62 % chance per floor of any, and runs on 60 % of its bays (about a third of the bays of every upper floor), where the photos of Via Cavour and Via Maqueda have them on nearly every window.

The rule (`oldHouses`, `edge()` in `src/buildings.js`): an old-town street wall is cut into houses of 10 to 24 m (one house under 15 m of wall). A house has its own plaster colour from `OLD_PAL` (the first keeps the building's own), its own bay width, its own storey count when the storey height stays within 22 % of the style's (so floor lines do not meet the neighbour's, as in the street), its own cornice depth and its own balcony habit: iron balconies on every floor in a run per window or two, a continuous one on the piano nobile only, a few, or none (palazzi: 38, 30, 22 and 10 % of houses; plain houses 18, 20, 34 and 28 %). It is all hashes of the wall position, so a rebuilt tile gets the same houses and the building's random sequence is not touched (a short wall keeps its colour and its bays). Ground-floor runs, the parapet and the cornice are laid per house. Backs, courts and party walls got nothing new that costs triangles (balconies are street only, as before). The blind walls (`old_wall`) got three variants that are not blind: a small stair window (some with a grille), a drainpipe with a meter box and a cable, the ghost of a demolished neighbour. They are the exposed flanks above a lower neighbour.

Stone fronts (`isStone`, a third or more of the old-town buildings in the oldest zones) had the old one-pane `stoneUp` window whatever the street. They now use the same windows, surrounds, shutters, hoods and top floor as the rendered fronts, drawn on ashlar (`stonify`, groups `ost_up`, `ost_nob`, `ost_top`, `ost_wall`: 14 atlas layers, so 17 with the flank variants; the group array grew from 24 to 32). At the same time the exposed flank of a stone house has a small window or a pipe now and then.

Budget, desktop 1280x720 and phone profile (844x390 at DPR 3, 4x CPU, `?fixres`), the old build and the new one alternated, three runs each, medians, main-thread ms per frame: Quattro Canti 2.60 and 2.55 (phone 12.05 and 12.30), Ballaro 3.00 and 3.04 (15.15 and 15.94), Via Cavour 2.24 and 2.30 (12.41 and 12.52), Via Maqueda 2.45 and 2.52 (10.65 and 10.79), Via Roma 2.37 and 2.33, Piazza Bellini 2.50 and 2.38. Desktop frames stay at the display's 16.8 ms. Triangles of the frame (shadow pass included) moved by -1.8 % to +3.2 % across those spots (Quattro Canti 752,903 to 739,455, Via Cavour 766,755 to 791,521), draw calls by -3 to +6, building geometry in memory by about 1 MB or less either way. The atlas is about 6 MB bigger (17 layers at the earlier per-layer figure). The phone figures are within the run-to-run spread except Ballaro (+0.8 ms), which is the one to look at again on a quiet machine. Driving 25 s up Via Maqueda and Via Cavour (two runs each): no frame over 50 ms on desktop in the new build, on the phone profile 76 against 69 frames over 25 ms on Via Maqueda, where the new run also drove 90 m further (more tiles), so the two are not comparable beyond "no new stutter that shows".

Still flat after this: party and flank walls of the dense block with no window at all, back walls of towers (ce04), blank long fronts outside the old-town zones (su05, Corso dei Mille, and the post-war flank at su01), church flanks and stone walls of monuments (xsd_0, ce03, ce08), and the hand-drawn Palmes and Biondo fronts, whose balconies are drawn in the tile and not built.

Not done: quoins and window hoods as geometry, iron canopies over doors (ce16), the houses rule for the long fronts outside the old-town zones, balconies on the plain `res` houses outside the old town (every balcony costs triangles and the streamer is at its `triCap` near Quattro Canti), a real 1950s concrete block (pilotis, deep stacked slabs, terracotta and white), the colour of the far low-detail city. Atlas: 84 to 120 layers, about 13 MB more GPU memory.

## Post-war blocks (round 2, item 4)

Photos: po24 (Via Notarbartolo), zi31 (Via Pitre), su43 (Via Messina Marine), pt24 (Via Giusti), xsc_0 (station), plus Via della Liberta, Viale Strasburgo and Viale Lazio. The game showed one grey-beige block with a balcony slab on every floor and a roller shutter on every ground-floor bay, and put it (or the old-town style) on the wrong buildings.

**Style choice, by height.** A 19th c. palazzo stops at about five storeys of 4 to 4.5 m; the blocks of the 1950s to 70s are taller. `PWH` (buildings.js) gives per zone the height from which a building is post-war (corso 29 m, old 27, kalsa and alberg 26, roma 24, calat 24, stazione 23, centro, borgoV, porto and politeama 22, oreto 21), with a ramp of 5 m starting 2 m below it. Above it an old-prior zone takes `pw`, `blk` or `pal` (`PWB`), below it `pw` and `blk` are off. Old-zone buildings use the new `PAL.pw` render colours, not the old palette, and the old-town facade (`B.old`) only goes to buildings that are not post-war, which fixes pt24 (35 m block in `centro` that turned old). Heights are the lidar heights (`r - g`) or the district estimate, so only measured or storey-counted buildings move. In the modern belts (`mid: true` in districts.js: periph, rigano, uditore, noce, zisa, brancaccio, corsoMille, cep, tn, arenella) 3 and 4 storeys up take apartment styles over houses (`fish` is now 1 to 2 storeys). Via Oreto next to the station is `stazione` (19th c. palazzi, xsc_0) instead of `oreto`, and Via Messina Marine is the new `marine` zone (orange and ochre, `pal` first, su43). The tile data has no OSM start date; footprint is used only as `area > 100` for a post-war block in an old zone.

**The facade.** `pw`, `blk` and `pal` share one generator (`S.pwf`). Per street wall a rhythm picks which bays are balcony-door bays (every bay, every other, two of three, one of three, random), a strip per run of equal bays uses the group `pwd` (French window with a tapparella down, half, open with curtains, a glazed veranda, laundry) or `pww` (plain windows, white persiane, a stair window with a drainpipe, a ribbon window, an awning); the shader picks the variant per bay and floor. `pwbd` and `pwbw` are the same on exposed brick (3 to 6 % of blocks, a near-white vertex colour so the brick keeps its own). The balcony (`pwBalc`) is geometry in front of every balcony-door bay on every floor: a deep slab (1.0 to 1.6 m, per block), soffit, top on the first floor only, a rail on the front and on the sides that do not touch a neighbour. Each block has two rails and a third for the odd floor, from `rail_s` (solid parapet), `rail_m` (aluminium tubes), `rail_x` (iron lattice), `rail_c`, `rail_a`, `rail_g`. Ground floor: glass shop fronts with different signs (`pwg`: optician, clothes, hairdresser, florist), plus the existing pharmacy, bar, tobacconist and lobby tiles on main streets, and on some blocks pilotis: the ground wall stands 2.6 to 3.8 m back, a soffit, two returns and a row of concrete columns (about 30 to 40 triangles per wall). The garage door (`g_garage`) is a group of four (light metal, brown, green, rolled up on a dark garage with a car), and the plain `res` ground floor has fewer shutters.

**Budget.** Full-detail building triangles of the resident tiles (`tris.mjs`-style count at six spots) before to after: Quattro Canti 487k to 486k, Via della Liberta 137k to 155k, Via Notarbartolo 127k to 134k, Via Giusti 81k to 88k, Via Pitre 177k to 167k, ZEN 150k to 136k. In the 1668 buildings around Viale Lazio the total is +5 % (the blocks 254 to 296 triangles each, the palazzine 369 to 277, the rest a little less), so the streamer there holds 4 full-detail tiles where it used to flip between 5 and 4 at the cap. Phone profile (844x390 at DPR 3, 4x CPU, `?fixres`), before and after alternated three times at three spots: Quattro Canti 11.0 and 11.1 ms, Via della Liberta 10.9 and 10.8, Via Notarbartolo 9.1 and 9.1 (medians); the first set (four spots) had the after build 0.1 to 0.9 ms faster, all inside noise. Paid for by: 6-sided water tanks with a cap of sides - 2 triangles (was 8 and 8), no hidden tops on tank stands and thin masts, one triangle per balcony bracket instead of a quad with a degenerate half, and no rail side where a neighbouring balcony stands. Atlas: the 7 layers of `blk_a` to `blk_e`, `pw_a` and `pw_b` are gone, 21 new ones (4 `pwg`, 5 `pwd`, 5 `pww`, 2 `pwbd`, 2 `pwbw`, 3 rails) and 3 more for the garage group: 120 to 137 layers, about 6 MB more. The group uniform array grew from 16 to 24 entries.

Not done: the top floor set back as an attico, balconies glazed in per flat as geometry, long OSM outlines that are really a row of houses (su43: one 2400 m2 outline reads as one house), fenced front gardens (zi31, su43), brick with its own tile for the ground floor, `ins` (ZEN) and the far low-detail colour.

## Landmarks, round 5: Grand Hotel et des Palmes (survey round 4, gap 4)

Round 4 found the Palmes front a plain yellow block with an even shutter grid and no entrance. Now (`src/hero-facades.js`, `assets/facades/specs.js`, `src/buildings.js`): every wing bay has a window down to the floor line with a hood on two scrolled consoles, and an iron balcony in front of it on the first three floors; the centre block (six bays) has pilasters, pedimented windows and one long balcony over the entrance; the entrance is a doorway two bays wide between two columns with the lit hall behind it and the hotel's name over it, under a glazed canopy. The balconies and the canopy are geometry, so they stand out of the wall and throw a shadow: a spec wall can now say `bal: [{ f, k, run, rail, dp }]` and `canopy: { k, dy, dp }` (field list at the top of `assets/facades/specs.js`; bays counted left to right as the viewer reads the wall, like `bl`). They use the old-town balcony builder (`obalc`) and a new 10-triangle canopy (`ocanopy`).

Drawn from knowledge of the building and of Palermo palaces of its time, plus Mapillary frames of the neighbouring street fronts (looked at, nothing copied or stored). The proportions of the entrance and the canopy, the name plate and the balcony floors are an estimate: no photograph of the entrance itself was found (the Mapillary search at the hotel found two frames facing the street front, neither of the doorway).

Cost: +618 triangles in the 250 m chunk that holds the hotel (27588 + 6708 to 28020 + 6894, counted from the loaded meshes, no extra mesh or draw call), three more atlas layers (`hr_palm_gel`, `hr_palm_ger`, `hr_palm_ct`, 256 KB each). The hotel is 880 m from the Quattro Canti.

## Landmarks, round 5: Teatro Biondo (survey round 4, gap 4)

Round 4 found the Biondo ground floor a flat arcade with a small portal, flatter than the photo wall it replaced. Now (`src/hero-facades.js`): every arch is a moulded ring that stands out of the rustication (shadow on the wall to its right, voussoirs, the thickness of the wall shown dark on one side) with an iron gate in it (bars, three rails, a fan of spokes, a scroll) over the dark hall; the middle bay is a deep entrance, two columns carrying an entablature with dentils, the gate leaves swung back on a lit hall, two steps. The piano nobile windows have a surround that stands out, a reveal, glazing bars and a fanlight, and an iron balcony in front of each, as geometry (`bal` in `assets/facades/specs.js`, new field `w`: the half width of one balcony).

Drawn from the Commons photo named in `specs.js` and from knowledge of Italian theatre fronts of its time. The Mapillary set has no frame facing the building (the search found one image within 70 m and none looking at it within 130 m), so the gates, the steps and the balconies are an estimate. Not done: the front's height. The OSM roof leaves the attic a 0.9 m strip, so the attic windows are slits (a data question, not a drawing one).

Cost: +162 triangles in the 250 m chunk that holds it (facade mesh 32124 to 32232, rail mesh 3298 to 3352, counted from the loaded meshes; no extra mesh or draw call), no new atlas layer. The theatre is 240 m from the Quattro Canti.
