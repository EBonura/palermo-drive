# Palermo centro storico: visual style guide

From 29 Wikimedia Commons photos, colour-sampled as the median of a hand-picked patch. Sampled hexes include the photo's lighting, so where it matters a suggested base (albedo) colour is given too. *est.* means estimated from proportions in photos (people ~1.7 m, railings ~1 m), not measured. Take street widths from OSM, not from here.

## 1. Ground

**Asphalt.** Sun-bleached, pale and patched, never deep black. Via Roma in sun samples `#9c9a8e`, a vicolo `#a09f9d`. Under evening light Via Maqueda reads `#563a37`. Suggested base `#7e7c76` with darker patch decals (`#5a5955`) and tyre-polished centre strips. Cracks and repair seams are everywhere.

**Balate (stone slabs).** Pedestrianised Via Maqueda, Corso near the Cattedrale and the piazzas use large grey-beige limestone slabs, worn smooth, with dark cracks and oil stains. Sampled `#b0a299` (Maqueda), `#7d756a` (Piazza Bellini, overcast), `#b5b6b8` (Piazza Verdi, very pale). Suggested base `#a69e92`, varied ±8% per slab. Maqueda slabs are irregular rectangles laid in running courses, *est.* 0.6 to 1.2 m long by 0.4 to 0.6 m wide (compared with a café table). Piazza Bellini uses smaller rectangular setts in stretcher bond, *est.* 0.3 x 0.5 m. Give it a 512px tile with 4 to 6 slabs, dark 1 to 2 cm joints, some slabs cracked through.

**Sidewalks and curbs.** On traffic streets (Via Roma, Foro Italico) sidewalks are grey stone slabs, sampled `#c1c3b8`, *est.* 2 to 3 m wide on Via Roma, often under 1 m or absent in vicoli. Curbs are the same pale limestone (Foro Italico curb `#d6d1cb`), *est.* 15 cm high, in long blocks with rounded worn arrises.

**Markings.** White zebras and stop lines, a yellow lane line on Via Roma (faded to `#acaca0`), all worn and patchy. A rainbow crossing on Via Maqueda (2026). Covers are rectangular cast iron, `#3a3836` *est.*

**Widths (est.).** Via Roma is the widest (two lanes plus sidewalks); Maqueda and the Corso are narrower, about a two-lane carriageway; vicoli 3 to 5 m with a car parked on one side.

Photos:
https://commons.wikimedia.org/wiki/File:Via_Maqueda_(Palermo)_19_06_2026_01.jpg
https://commons.wikimedia.org/wiki/File:Via_Maqueda_(Palermo)_19_06_2026_02.jpg
https://commons.wikimedia.org/wiki/File:Via_Roma,_Palermo,_Italy_(9458190046).jpg
https://commons.wikimedia.org/wiki/File:Kalsa,_Palermo,_Italy_-_panoramio_(4).jpg
https://commons.wikimedia.org/wiki/File:Piazza_Giuseppe_Verdi,_Palermo.jpg
https://commons.wikimedia.org/wiki/File:Italian_style_street,_Palermo,_Sicily_(9456390817).jpg
https://commons.wikimedia.org/wiki/File:Porta_Felice_(Palermo)_msu2017-0106.jpg

## 2. Facades

The base material everywhere is golden calcarenite (tufa) ashlar. Where plaster has fallen off, that stone shows through. Plan the texture as plaster over a stone layer, revealed by a decay mask.

| Type | Wall | Trim / stone | Shutters |
|---|---|---|---|
| Baroque palazzo (Corso, Quattro Canti) | exposed or washed tufa `#a6875b` to `#b9a185` | darker weathered stone `#6e6458`, grey marble columns `#9a9290` | dark green `#4c5c51` |
| 19th c palazzo (Maqueda, Verdi, Vucciria) | cream `#d9cab7`, buff `#af9c8d`, salmon/pink-ochre `#c9a293` | stone-coloured frames `#bc9979`, string courses | brown `#3c2724` |
| Plain residential (vicoli, Albergheria) | yellow ochre `#c7a373`, pale yellow `#d8c48a` *est.*, patched | none or plain bands | green `#6e8d90` faded, or brown |
| Liberty (Piazza Verdi) | warm brown-pink `#8b6f63` | carved stone bay windows, grouped windows | brown |
| Post-war concrete (inner Albergheria, Via Roma back lots) | off-white / grey `#d0cbc2` *est.* | concrete balcony slabs with solid parapets | roller blinds, aluminium |
| Church / civic stone | tufa `#a6875b` lit, `#75706c` in shade | same stone | none |

**Rhythm (est.).** Floor height 4 to 5 m on palazzi (taller piano nobile), 3 to 3.3 m on post-war blocks. Bay width 3.5 to 4.5 m. Each bay is one tall French window *est.* 1.2 x 2.6 m with its own balcony. A typical Corso facade is 3 to 4 bays per building.

**Balconies.** Thin stone slab, *est.* 0.6 to 0.9 m deep, on curved wrought-iron brackets (very visible from below, model them as a fan of 5 to 8 dark brackets). Railings are black wrought iron (`#33333d`), simple verticals on 19th c buildings, bellied "goose-breast" on baroque ones. Expect 1 balcony per bay on the piano nobile and on upper floors, sometimes a continuous balcony across 2 to 3 bays. Laundry lines, potted plants, AC units and striped fabric awnings (blue/white, red/white) are typical, much denser in vicoli than on the Corso.

**Ground floor.** Shop units with grey roll-down saracinesche (`#6a6a68` *est.*), arched carriage entrances (*est.* 3 to 4 m wide) with grey stone columns on baroque palazzi, signage panels above shops, tangles of cables and street-lamp brackets across the facade.

**Cornices.** Projecting stone cornice at the roofline on every palazzo, string courses at each floor on 19th c buildings, window pediments (triangular or segmental) on the piano nobile.

**Decay.** Heavy. Peeling plaster revealing tufa (Ballarò corner building is almost fully stripped), black water streaks below cornices and balconies, broken or boarded windows, plants growing on ledges. Clean civic buildings (Palazzo delle Aquile, Teatro Massimo) are the exception.

**Floors per street (est.).** Corso and Maqueda 4 to 5; Via Roma 5 to 6; Vucciria/Ballarò/Kalsa vicoli 3 to 5; Piazza Verdi 5 to 6.

Photos:
https://commons.wikimedia.org/wiki/File:Corso_Vittorio_Emanuele_(Palermo)_14_07_2024_01.jpg
https://commons.wikimedia.org/wiki/File:Vucciria_(Palermo)_14_07_2024_01.jpg
https://commons.wikimedia.org/wiki/File:Ballar%C3%B2_-_Palermo,_Italia_-_28_Aprile_2023.jpg
https://commons.wikimedia.org/wiki/File:Palermo_-_Albergheria_0777.jpg
https://commons.wikimedia.org/wiki/File:Italian_style_street,_Palermo,_Sicily_(9456390817).jpg
https://commons.wikimedia.org/wiki/File:Piazza_Giuseppe_Verdi,_Palermo.jpg
https://commons.wikimedia.org/wiki/File:Via_Roma,_Palermo,_Italy_(9458190046).jpg

## 3. Rooftops

From above the centro is a dense mix of flat terraces and low-pitch terracotta tile roofs, roughly half and half in the aerial views (*est.*). Terraces are pale (`#d8cfc4` *est.*) with low parapets (*est.* 1 m), small boxy stair/room structures, TV antennas and satellite dishes (seen in the vicolo photo). Tiles read `#b0603f` *est.* faded. Overall from the air it averages to a warm beige-pink: distant rooftops sample `#908981`, the low-sun aerial `#606579` (heavily hazed). Domes punctuate it: green-and-yellow majolica (Santa Caterina and others), grey lead (Cattedrale), red (San Cataldo). I could not confirm rooftop water cisterns at this resolution; treat them as unverified.

Photos:
https://commons.wikimedia.org/wiki/File:Palermo_catedral_rooftop_panorama_Sicily_2026.jpg
https://commons.wikimedia.org/wiki/File:Centro_palermo_e_piazza_politeama_dall%27alto.jpg
https://commons.wikimedia.org/wiki/File:La_cala_dall%27alto.jpg
https://commons.wikimedia.org/wiki/File:Rooftop,_Cathedral_of_Palermo.jpg

## 4. Street furniture and life

**Lamps.** Three kinds: black cast-iron wall-bracket lanterns on curly brackets (Corso, Vucciria, Albergheria, *est.* mounted 4 to 5 m up); black multi-arm candelabra posts with 3 to 5 globe lanterns in Piazza Pretoria and outside Palazzo delle Aquile (*est.* 4 to 5 m); tall grey steel poles with a curved double arm on Foro Italico and Via Roma (*est.* 9 to 10 m). Cheap white cobra-head lamps on wall arms in vicoli.

**Bins.** Dark green cassonetti (`#4b6a5a`), graffiti-covered, with heaped bin bags beside them.

**Trees.** Tall fan palms (Teatro Massimo, Cattedrale, Piazza Bellini), date palms, oleander with pink flowers, clipped hedges (Cattedrale garden), ficus.

**Vehicles seen.** Fiat Panda (old boxy and new), Fiat Punto, Hyundai Atos, VW Golf, Citroën C3, Fiat Doblò white van, Piaggio Porter pickup. Colours: white, silver, dark grey, black, light blue. Scooters (Piaggio Liberty/Beverly type) parked on curbs. Piaggio Ape and Ape Calessino "Apetaxi" tourist three-wheelers in cream or orange with burgundy fabric canopy, plus horse carriages near the Cattedrale.

**Taxis.** No Commons photo found. Italian licensed taxis are white with a roof "TAXI" sign; this is general knowledge, not verified from photos.

**Markets.** Vucciria and Ballarò: canvas awnings and big square café umbrellas (cream, dark green, blue), tables of goods, hanging bags, produce crates, strings of bare bulbs.

Photos:
https://commons.wikimedia.org/wiki/File:Palermo,_Sicilia,_Italia_Ap_2024_-_Street_scene_with_3_wheelers.jpg
https://commons.wikimedia.org/wiki/File:Palermo_-_Albergheria_0777.jpg
https://commons.wikimedia.org/wiki/File:Vucciria_(Palermo)_14_07_2024_01.jpg
https://commons.wikimedia.org/wiki/File:Ballar%C3%B2_-_Palermo,_Italia_-_28_Aprile_2023.jpg
https://commons.wikimedia.org/wiki/File:Piazza_e_fontana_Pretoria_Palermo.jpg
https://commons.wikimedia.org/wiki/File:Porta_Felice,_Palermo,_Sicily,_Italy_(9458361904).jpg

## 5. Landmarks

**Quattro Canti.** Four identical concave (quarter-circle) facades chamfering the Maqueda/Corso crossing. Each has 3 tiers plus a crowning coat of arms: ground tier with a fountain basin and statue, middle tier with a king in a niche and a continuous curved balcony, upper tier with a saint in a niche. Paired grey marble columns (`#59575c`) flank each niche, one green-shuttered window either side. Stone is dark weathered ochre (`#534b40` to `#9a9786`), heavily blackened. Model as a 4-segment curved facade, 3 vertical bays.
https://commons.wikimedia.org/wiki/File:Quattro_canti_(Palermo)_01.jpg
https://commons.wikimedia.org/wiki/File:Corner_1_-_Quattro_canti_-_Palermo_-_Italy_2015.JPG

**Fontana Pretoria.** Large oval sunken basin ringed by a white marble balustrade with radial staircases, dozens of white marble statues on pedestals, central 3-tier fountain. Marble weathered to `#939182`. Fully fenced by a black iron railing (*est.* 1.5 m). Backdrop: Santa Caterina with its green/yellow chevron majolica dome, Palazzo delle Aquile on the left.
https://commons.wikimedia.org/wiki/File:Piazza_e_fontana_Pretoria_Palermo.jpg

**Teatro Massimo.** Neoclassical. Hexastyle Corinthian portico with triangular pediment on a podium, reached by a wide flight of steps between two bronze lions on plinths. Behind, a low dome. Side wings with round-arched windows. Stone `#9e938f` to `#878377`, deep red/maroon wall inside the portico (`#432b41`). Fenced garden with palms and oleanders in front.
https://commons.wikimedia.org/wiki/File:Teatro_Massimo_Vittorio_Emanuele_(Palermo).jpg

**Cattedrale.** Long golden tufa body (`#a6875b` lit) with continuous Arab-Norman crenellations, slender corner towers with stacked arched openings and pinnacles, south porch of 3 pointed arches under a gable, a clock tower, and a neoclassical grey-green lead dome (`#a9aca5`) with a lantern. Large paved forecourt with hedges, palms and a statue column.
https://commons.wikimedia.org/wiki/File:Panoramica_Cattedrale_di_Palermo.jpg
https://commons.wikimedia.org/wiki/File:Rooftop,_Cathedral_of_Palermo.jpg

**Porta Nuova.** Tall rectangular gate tower. Lower stage: rusticated round arch, outer face with carved telamon figures. Middle: plain ashlar with small windows and stone eagle reliefs. Top: open loggia of 5 round arches on white columns, white balustrades, then a pyramidal majolica tile roof (`#cbb176`, eagle pattern) capped by a gilded octagonal lantern (`#a47a32`). Stone `#7b6150` low, paler above.
https://commons.wikimedia.org/wiki/File:Porta_Nuova_(Palermo)_01.jpg
https://commons.wikimedia.org/wiki/File:Palermo-Porta-Nuova-bjs-1.jpg

**Porta Felice.** Two separate pylons with no arch between them, the Corso running through the gap to the Foro Italico. Each pylon: paired columns framing a statue niche over a fountain, a balcony storey with an arched opening, eagle crest and urns on top. Pale grey-white marble (`#e0ddd6`), side walls pinkish plaster (`#e7d6c6`).
https://commons.wikimedia.org/wiki/File:Porta_Felice_(Palermo)_msu2017-0106.jpg
https://commons.wikimedia.org/wiki/File:Porta_Felice,_Palermo,_Sicily,_Italy_(9458361904).jpg

**Palazzo dei Normanni.** Long composite front on Piazza del Parlamento: left, a pink-salmon plastered wing (`#c9a293`) with regular pedimented windows and baroque portal; centre, the bare grey-brown stone Torre Pisana (`#7a7977`) with large blind pointed arches; small dark observatory domes on the roof. Low walls and hedges in front.
https://commons.wikimedia.org/wiki/File:0564_-_Palermo_-_Palazzo_dei_Normanni,_facciata_principale_-_Foto_Giovanni_Dall%27Orto,_28-Sept-2006.jpg
https://commons.wikimedia.org/wiki/File:Panorama_of_Palazzo_dei_Normanni,_Palermo,_Sicily,_Italy_(9459359240).jpg

**San Cataldo.** A near-cube of bare tufa (`#75706c` shade) on a raised terrace, walls articulated by tall blind arches with small lattice windows, a pierced crenellated cornice, and three squat red domes in a row, each pierced by small windows near its base. Dome colour samples `#834b4a` in flat light; suggested base `#b8665f` *est.* with mottled weathering. Next to it the Martorana bell tower and church.
https://commons.wikimedia.org/wiki/File:Chiesa_di_San_Cataldo_in_Palermo_-_2007.jpg
https://commons.wikimedia.org/wiki/File:Kalsa,_Palermo,_Italy_-_panoramio_(4).jpg

**Palazzo delle Aquile.** Clean rectangular block, ochre-gold (`#ac814c`) with incised ashlar pattern over the whole surface, grey/white stone window frames, small stone balustrade balconies on the piano nobile, 3 main storeys plus mezzanine windows. Central clock under a small bell gable on the roofline, an eagle statue at the corner. Raised on steps from the piazza.
https://commons.wikimedia.org/wiki/File:Palazzo_Pretorio_facciata.jpg

## 6. Light and atmosphere

Clear days: zenith `#3a7ebf` to `#57a4ec`, horizon `#8ac8f7` to `#81caff` (very saturated, clean blue). The Conca d'Oro mountains always close the long views (Porta Nuova arch, Porta Felice, Via Roma); render them as hazed blue `#7297b4`. Low sun gives a pink-lilac haze over the city (`#b6a6a9`). Overcast skies (many winter photos) are flat light grey with no blue.

The sun is strong and warm and the stone glows gold. Vicoli and the Corso sit mostly in shadow, with sun only on upper floors and long diagonal shadows across facades; shaded walls go cool grey-brown. Laundry and awnings throw small dappled shadows.

Grading: warm highlights, slightly desaturated plaster mid-tones, cool shadows, light distance fog tinted toward the horizon blue. Keep asphalt light: dark asphalt is the quickest way to make it look like the wrong city.

Photos:
https://commons.wikimedia.org/wiki/File:Panoramica_Cattedrale_di_Palermo.jpg
https://commons.wikimedia.org/wiki/File:Porta_Felice_(Palermo)_msu2017-0106.jpg
https://commons.wikimedia.org/wiki/File:Palermo_catedral_rooftop_panorama_Sicily_2026.jpg
https://commons.wikimedia.org/wiki/File:Centro_palermo_e_piazza_politeama_dall%27alto.jpg
https://commons.wikimedia.org/wiki/File:Porta_Nuova_(Palermo)_01.jpg
https://commons.wikimedia.org/wiki/File:La_Cala_Palermo.JPG
