# The rave missions: sources and notes

Two linked night missions (src/event-rave.js, src/rave.js; data in src/event-places.js `RAVE`, baked by assets/missions/snap-places.mjs).

## The real place

**Centro sociale ExKarcere**, Via San Basilio 17, 90133 Palermo, in the Albergheria / La Loggia quarter, in a municipal building (the centre is known for the evictions it fought and for its after-school and neighbourhood activities).
- Address: questoapp.com/places-to-visit/palermo/centro-sociale-ex-karcere ("Via S. Basilio, 17, 90133 Palermo PA"), and the local press (livesicilia.it/centro-sociale-exkarcere-sospeso-lo-sgombero, which puts it on Via San Basilio, in the Albergheria, and says the building belongs to the Comune; balarm.it events for the centre, "Centro Sociale ExKarcere").
- Position: OpenStreetMap Nominatim, "Via San Basilio, La Loggia, I Circoscrizione, Palermo, 90133": 38.11887, 13.36104 (the middle of the street; the house number is not on the map). The game's tiles have the same street (Via San Basilio, 6 m wide, from about (-93, -380) to (50, -305) in local metres); the mission's door is the nearest drivable point of it, (-19.4, -348.4).
- The game says nothing about the centre beyond its name; the sound man is invented.

## The game

- **Casse pû rave** (kind `rave`, night): the sound man (a DJ sprite) at the Karcere; carry the speakers to the rave. 5.55 km by road (baked route), time = length / 9 + 55 s (about 10:45), fragile cargo: a sudden loss of speed above 4 m/s costs 3.4 percent of the speakers per m/s (at most 34 percent a knock, 0.7 s apart); at 0 the rave is off, with the clock out too. Pay: 12 + length / 500 euros times the health left, plus up to 8 euros for time left. On delivery the rave is **powered** for the night: louder, brighter, 22 people instead of 12.
- **Fuogghi allegri** (kind `leaf`, night): a friend at the rave sends you to Via Cipressi (7.2 km), seven leaves lie within 150 m of its end (a green leaf with a small smile: a wink, nothing more), then you hand them to a pal on the street. Time to get there length / 9 + 60 s, 85 s for the hunt, 70 s for the hand-over. Pay 6 + 3.5 per leaf, +10 for all of them.
- **The rave** (src/rave.js): a terrace cut into the open scrub 45 m east of the first hairpin of Via Pietro Bonanno (local (615, -4556), 38.15694, 13.36828), stage with two speaker stacks and a DJ, six searchlight beams and two floor discs that follow the beat, a ring of lamps, the crowd, and a house loop made of oscillators (kick, clap, hat, bass line at 138 bpm: nothing recorded); the car radio ducks while it is audible. Night only; built within 560 m, the sound is heard within about 360 m and follows the music volume option.
- **The leash** (src/missions.js): both have their own area (the line from the start to the destination, 650 and 700 m round it).
- Map pins: violet (rave) and green (leaf), only at night.

## Lines for the owner to correct (Palermitan, written by an agent)

All in assets/missions/lines.js (`CALL.rave`, `CALL.leaf`, `RAVE_LINES`) and in the `T(...)` calls of src/event-rave.js: the callers, the thanks, the "Crac!" on a knock, "Casse rutte!", "Taiddu assai!", "Attruova i fuogghi allegri!", "Portali ô cumpari". Spelling after the owner's: stressed o to uo/ua, stressed e to ie, r before a consonant to i.
