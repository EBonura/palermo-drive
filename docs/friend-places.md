# Ideas of a local friend of the owner (Nov 2026): places, sources, doubts

Where each thing stands, where that comes from and how sure it is. Positions are in `src/friend-places.js` (the stops), `src/event-places.js` (the race) and `assets/missions/lines.js` (the stigghiolaro).
All the lines are drafts in the owner's Palermitan spelling, for the owner to correct: `assets/missions/lines.md` has them with the English. Lookups: OpenStreetMap Nominatim at one request a second,
the shops' own pages and listings; nothing was copied from a page.

## "Pezzo nni Ganci" (Ganci rosticceria)

A stop at each branch that a source confirms: a small shopfront on the kerb with a GANCI sign (drawn in code, no logo), a seller, a pin on the minimap. Stop in the ring and you get a pezzo: the same nitro
treat as the stigghiola (0.8 on top of what you have, even past full, then 50 s). They are not food-hunt places: the lost-food mission would stand on the same spot as the stop and the two would start together.

| Branch | Source | How sure |
|---|---|---|
| Via Cala 120 | gancisicilianfood.it (the shop's own page) | the street (OSM "Via della Cala") yes; the place along it is a guess, the house number is not on the map |
| Via Francesco Crispi 104 | gancisicilianfood.it | same |
| Largo Salvatore Caronia Roberti, Addaura | gancisicilianfood.it | the square is not in OSM; the bus stop named after it is (Nominatim 38.19089, 13.34428, Lungomare Cristoforo Colombo): fair |
| Via Brunelleschi 66 | gancisicilianfood.it | the street is "Via Filippo Brunelleschi", Inserra (the only one in Palermo itself); the place along it is a guess |
| Via Rocco Jemma 8 (Policlinico) | Apple Maps place "Ganci Cornetteria Rosticceria" (I6A96A8024CF75068) and oraridiapertura24.it | street yes, the end towards the Policlinico |
| Caffe Ganci e Figli, Via Aurelio Drago | OpenStreetMap node 5057886471 | the node is 6 m from the stand; not known whether it is the same family as the others, so its sign says "GANCI & FIGLI, CAFFÈ" |

Not built: Via Thaon di Revel 56 (on the shop's page, but the street is neither in OpenStreetMap nor in the world tiles, so there is no road to put it on), Via Torre di Mondello 10, Via Malaspina 121
(no page that could be read confirms them; the Just Eat and PalermoToday pages gave 403) and Via Corselli 12 ("Al Cornettone", doubtful as the brief said). Each can be added to `GANCI_SITES` when a source is found.

## "A preghiera alla santuzza"

Two prayer stops, one cooldown (300 s) shared by both. Stay still in the ring for 2.4 s: the wanted level goes and the neighbourhoods forget what you did (`pd-blessed`, `src/police.js`); with nothing to
forgive you get a little nitro. No repair: the lapa has no damage model. Both numbers are in `src/friend-places.js` to tune.

- The shrine: a wayside shrine drawn in code at the end of the service road in front of the stair of the Santuario di Santa Rosalia (the landmark of `src/lmc-a.js`; the cart of the pollanche is beside it).
  The shrine itself is ours; the place is the real foot of the stair.
- The carro of Santa Rosalia (the Festino float), drawn in code as a landmark: a red and gold wagon, two ivory tiers with gilded pilasters and rose panels, a round temple with a dome and the saint under it, garlands of roses.
  **It is not where the real one stands.** The owner said "just put it somewhere visible" (4 Nov 2026): it is on the dirt strip of the Foro Italico lawn, 19 m from the road (the Festino ends there). Where the sources put the
  real one: Piazza Marina in front of Palazzo Galletti ("per sempre" after the Festino of 2021, blogsicilia.it), then Foro Umberto I until July 2024, then Via Matteo Bonello beside the Cattedrale
  (balarm.it 25 July 2024, palermotoday.it, artribune.com for the 2026 Festino, where it is still said to be). The friend's "always in the usual place" was not found as such. `CARRO.on` in `src/friend-places.js` switches it off.

## "Cornetto i menzannuatti"

Two kiosks that are shuttered by day and open from 23:30 to 06:00 (game hours, `CORNETTO_HOURS`): the seller, a queue of four night people, a warm glow, a pin on the minimap and a nitro treat (as the granita of U Barettu,
whose kiosk code they reuse). By day: a roll-down shutter, no seller, no queue, no pin, no stop.

- **At Cornetteria Chioschetto Court** (the owner's name for it): listings (seeker.io, restaurantguru.com, parrocchiamadonnadipompei.it, caffe-ristorante-bar.it) give Via Costantino Lascaris 10, 90138 Palermo.
  That street starts at Piazza Porta Guccia on Corso Alberto Amedeo, where the kiosk's Facebook page ("Piazzetta Porta Guccia") and vacanzesiciliane.net (Corso Alberto Amedeo 182, "a pochi passi dal tribunale") put it,
  so number 10 is its east end, about 130 m from the Palazzo di Giustizia. It is not "behind" the building; no source says so.
- **Cornuit**: the owner's address, Gastronomia Cornuit, Via Giuseppe Lanza di Scalea 338-342, Palermo. Nominatim has the street, not the numbers; OpenStreetMap has no feature for it. The stand is on that street at the
  point nearest to the coordinate Virgilio gives for the address (38.167, 13.3167), in San Lorenzo, 36 m from Via San Lorenzo.

## "La corsa illegale chi cavaddi"

The night race `corse` (horse and sulky, scooters escorting, a crowd), 600 m on Viale delle Scienze before, now 1866 m: it starts in front of the University as before and goes on along the outbound
carriageway of Via Ernesto Basile (one-ways obeyed, `via` in `RACES`, routed by `assets/missions/snap-places.mjs`) to the foot of the ramp of the bridge that carries Via Ernesto Basile over Viale Regione Siciliana
Sud Est (OSM ways 34015846 and 34015847 of the tiles, deck about 72.5 m); the line ends 35 m before the ramp (`finish`). Four sulkies against you (sauro, morello, grigio, baio), prize 70, 30, 12 (that of the Regione sprint,
which has about the same length). The title is the friend's, the same in both languages.

## Lo stigghiolaro under the Basile bridge

A stigghiola cart with its smoke plume (the existing cart code) in the verge strip on the right side of Viale Regione Siciliana Sud Est travelling out of town towards Bagheria (the south-east carriageway, OSM way
12229 of the tiles, one-way), under the deck of Via Ernesto Basile; 8.1 m from the carriageway line, 2.6 m clear of its edge, so the cart does not stand in a lane. Headroom: the deck is about 5.4 m above the
road below (`RISE` in `src/bridges.js`), the umbrella is about 2.6 m high. `STIGGHIOLA_FAR` in `assets/missions/lines.js`. It has no name: the sign says STIGGHIOLA.
