# Danger levels

Every place in the city has a danger level from 1 (quiet) to 5 (the ZEN). The level decides how touchy the area is (how fast the damage you do there brings a gang block) and how many police patrols you see; the capsule shows it as a small number and the tint of the diamonds. This supersedes `docs/danger-draft.md` (the draft this table was built from).

**IDISE measures hardship, not crime.** The source is ISTAT's IDISE, "Disagio socio-economico a livello sub-comunale, anno 2023", the socio-economic hardship index (nine indicators on income, work, education, housing; no crime among them), published for Palermo at the 55 UPL (Unità di Primo Livello) areas. The levels are a game-design call made by the owner on top of that ranking, not a statement about crime or about the people who live there. ISTAT content is CC BY 4.0 unless stated otherwise (istat.it/note-legali); credit ISTAT if the numbers are shown.

## How the lookup works

- `tools/danger.py` rebuilds the UPL outlines from the 3,600 census-section polygons of ISTAT's `Palermo.html` map (each section carries its UPL code), rasterises them on a 100 m grid in game metres, and writes `src/danger-data.js` (about 5.5 KB: the run-length coded grid plus a name and a level per UPL). Cells in no section but touching one take that UPL (street gaps); the rest is no data.
- `src/danger.js` looks a position up: `dangerAt(x, z)`, `areaAt(x, z)`. It is independent of the game's style zones (`src/districts.js`) and of the QUARTIERI points.
- One level per UPL. Where one UPL holds quartieri with different calls, the call that fits the area best won (below).
- **No data** (port, open country, parks, sea front without residents): level 2. Parks and countryside are not safe at night, but nobody lives there to set the tone; 2 also gives Parco della Favorita the level the owner asked for. No-data places have no name (the capsule says Palermo) and share one score between them.

## Final calls

Start: the draft quintile per UPL (docs/danger-draft.md). Then the owner's calls: 5 ZEN and Brancaccio; 4 Borgo Nuovo, Bellolampo (CEP), Ciaculli, Croce Verde, Roccella, Zisa; 3 Albergheria, Il Capo, Bandita, Acqua dei Corsari, Pomara, Altarello, Noce, Falsomiele, Chiavelli, Settecannoli, Romagnolo, Arenella, Acquasanta, Villaggio Santa Rosalia; 2 Kalsa, La Loggia, Parco della Favorita and every other draft 2 to 4; 1 Mondello, Valdesi, Addaura, Monte Pellegrino, Libertà/Politeama, Resuttana, Quartiere Matteotti, San Lorenzo and drafts of 1.

Counts: level 5 two UPLs, level 4 four, level 3 twelve, level 2 twenty-four, level 1 thirteen (55 in all).

Calls I had to make:

- **Roccella Acqua dei Corsari** (one UPL, 28,500 residents): Roccella is 4, Bandita, Acqua dei Corsari and Pomara are 3. Took 4: Roccella is the dense, populated part, the other three are small hamlets on its edge.
- **Partanna Mondello**: Mondello, Valdesi and Addaura are 1, Partanna would be 2 by the rule. Took 1 (three of four, and the resort is the face of the area).
- **San Lorenzo**: it holds the point of Parco della Favorita (2) and San Lorenzo (1). Took 1; the park itself has no residents, so it is no data and gets 2 anyway.
- **Oreto Perez and Cantieri**: draft 5 and not in the owner's lists. Took 3, the level the owner gave the other draft-5 areas that are not in the top two tiers (Albergheria, Il Capo, Altarello).
- UPLs with no quartiere point and draft 2 to 4 follow the remaining rule (2); the Libertà belt (Politeama, Notarbartolo, Villa Sperlinga, Villabianca and the rest of the draft 1 UPLs) is 1.
- The names in the capsule use the quartiere name where the UPL has one, a short form of the ISTAT name otherwise (Politeama, Terrasanta, Villabianca, Quattro Camere, ...).

### Per UPL

| Level | UPL (ISTAT) | Name in game | IDISE 2023 | Draft | Quartieri inside |
|---|---|---|---|---|---|
| 5 | San Filippo Neri | ZEN | 111.34 | 5 | Zen |
| 5 | Brancaccio Conte Federico | Brancaccio | 106.24 | 5 | Brancaccio |
| 4 | Zisa - Ingastone | Zisa | 105.11 | 5 | Zisa |
| 4 | Roccella Acqua dei Corsari | Roccella | 104.64 | 5 | Roccella, Bandita, Acqua dei Corsari, Pomara |
| 4 | Ciaculli Croce Verde | Ciaculli | 104.15 | 5 | Ciaculli, Croce Verde |
| 4 | Borgo Nuovo | Borgo Nuovo | 104.11 | 5 | Borgo Nuovo, Bellolampo |
| 3 | Palazzo Reale o Albergaria | Albergheria | 109.71 | 5 | Albergheria |
| 3 | Monte di Pietà o Seralcadi | Il Capo | 107.61 | 5 | Il Capo |
| 3 | Oreto Perez | Oreto | 104.31 | 5 | none |
| 3 | Cantieri | Cantieri | 104.25 | 5 | none |
| 3 | Altarello - Tasca Lanza | Altarello | 103.89 | 5 | Altarello |
| 3 | Acquasanta | Acquasanta | 103.73 | 4 | Acquasanta |
| 3 | Chiavelli - S.Maria di Gesù | Chiavelli | 103.16 | 4 | Chiavelli |
| 3 | Noce | Noce | 103.14 | 4 | Noce |
| 3 | Settecannoli | Settecannoli | 102.55 | 4 | Settecannoli, Romagnolo |
| 3 | S.Rosalia | Villaggio Santa Rosalia | 102.29 | 4 | Villaggio Santa Rosalia |
| 3 | Arenella | Arenella | 102.29 | 4 | Arenella |
| 3 | Falsomiele Borgo Ulivia | Falsomiele | 102.27 | 4 | Falsomiele |
| 2 | Montegrappa | Montegrappa | 102.75 | 4 | none |
| 2 | Tribunali o Kalsa | Kalsa | 102.69 | 4 | Kalsa |
| 2 | Castellammare o Loggia | La Loggia | 102.59 | 4 | La Loggia |
| 2 | Boccadifalco - Baida | Baida | 102.22 | 4 | Baida, Boccadifalco |
| 2 | Corso dei Mille - S.Erasmo | Corso dei Mille | 102.04 | 3 | none |
| 2 | Sferracavallo | Sferracavallo | 101.87 | 3 | Sferracavallo |
| 2 | Passo di Rigano | Passo di Rigano | 101.55 | 3 | Passo di Rigano |
| 2 | Borgo Vecchio - Principe Scordia | Borgo Vecchio | 101.45 | 3 | none |
| 2 | Oreto Guadagna | Guadagna | 101.03 | 3 | Guadagna |
| 2 | Olivuzza | Olivuzza | 100.77 | 3 | Olivuzza |
| 2 | Villagrazia | Villagrazia | 100.75 | 3 | Villagrazia |
| 2 | San Giovanni Apostolo | San Giovanni Apostolo | 100.67 | 3 | none |
| 2 | Vergine Maria | Vergine Maria | 100.32 | 3 | Vergine Maria |
| 2 | Parlatore - Serradifalco | Serradifalco | 99.94 | 3 | none |
| 2 | Cruillas | Cruillas | 99.84 | 3 | Cruillas, Inserra |
| 2 | Cuba - Calatafimi | Cuba - Calatafimi | 99.62 | 2 | none |
| 2 | Patti - Villaggio Ruffini | Patti | 99.43 | 2 | Patti |
| 2 | Tommaso Natale - Sant'Ambrogio - Cardillo | Tommaso Natale | 99.16 | 2 | Cardillo, Tommaso Natale |
| 2 | Bonagia | Bonagia | 98.97 | 2 | none |
| 2 | Pallavicino | Pallavicino | 98.28 | 2 | Pallavicino |
| 2 | Mezzomonreale | Mezzomonreale | 97.94 | 2 | Pagliarelli, Molara |
| 2 | Villa Tasca | Villa Tasca | 97.51 | 2 | none |
| 2 | Uditore | Uditore | 97.29 | 2 | Uditore |
| 2 | Zisa - 4 Camere | Quattro Camere | 97.22 | 2 | none |
| 1 | Partanna Mondello | Mondello | 97.86 | 2 | Partanna, Mondello, Valdesi, Addaura |
| 1 | Montepellegrino | Monte Pellegrino | 96.99 | 2 | Monte Pellegrino |
| 1 | San Lorenzo | San Lorenzo | 95.28 | 1 | San Lorenzo, Parco della Favorita |
| 1 | Leonardo da Vinci - Di Blasi | Leonardo da Vinci | 94.82 | 1 | none |
| 1 | S.Francesco di Paola - Terrasanta | Terrasanta | 94.58 | 1 | none |
| 1 | Marchese di Villabianca - Sampolo | Villabianca | 94.13 | 1 | none |
| 1 | Malaspina - Leonardo da Vinci | Malaspina | 93.58 | 1 | none |
| 1 | Croci - Ruggiero Settimo | Politeama | 93.25 | 1 | none |
| 1 | Notarbartolo - Giardino Inglese | Notarbartolo | 93.03 | 1 | none |
| 1 | Principe di Palagonia | Principe di Palagonia | 92.92 | 1 | none |
| 1 | Villa Sperlinga | Villa Sperlinga | 92.77 | 1 | none |
| 1 | Vittorio Veneto | Quartiere Matteotti | 92.57 | 1 | Quartiere Matteotti |
| 1 | Resuttana | Resuttana | 92.44 | 1 | Resuttana |


### Per quartiere

| Quartiere | Level | UPL |
|---|---|---|
| Brancaccio | 5 | Brancaccio Conte Federico |
| Zen | 5 | San Filippo Neri |
| Acqua dei Corsari | 4 | Roccella Acqua dei Corsari |
| Bandita | 4 | Roccella Acqua dei Corsari |
| Bellolampo | 4 | Borgo Nuovo |
| Borgo Nuovo | 4 | Borgo Nuovo |
| Ciaculli | 4 | Ciaculli Croce Verde |
| Croce Verde | 4 | Ciaculli Croce Verde |
| Pomara | 4 | Roccella Acqua dei Corsari |
| Roccella | 4 | Roccella Acqua dei Corsari |
| Zisa | 4 | Zisa - Ingastone |
| Acquasanta | 3 | Acquasanta |
| Albergheria | 3 | Palazzo Reale o Albergaria |
| Altarello | 3 | Altarello - Tasca Lanza |
| Arenella | 3 | Arenella |
| Chiavelli | 3 | Chiavelli - S.Maria di Gesù |
| Falsomiele | 3 | Falsomiele Borgo Ulivia |
| Il Capo | 3 | Monte di Pietà o Seralcadi |
| Noce | 3 | Noce |
| Romagnolo | 3 | Settecannoli |
| Settecannoli | 3 | Settecannoli |
| Villaggio Santa Rosalia | 3 | S.Rosalia |
| Baida | 2 | Boccadifalco - Baida |
| Boccadifalco | 2 | Boccadifalco - Baida |
| Cardillo | 2 | Tommaso Natale - Sant'Ambrogio - Cardillo |
| Cruillas | 2 | Cruillas |
| Guadagna | 2 | Oreto Guadagna |
| Inserra | 2 | Cruillas |
| Kalsa | 2 | Tribunali o Kalsa |
| La Loggia | 2 | Castellammare o Loggia |
| Molara | 2 | Mezzomonreale |
| Olivuzza | 2 | Olivuzza |
| Pagliarelli | 2 | Mezzomonreale |
| Pallavicino | 2 | Pallavicino |
| Passo di Rigano | 2 | Passo di Rigano |
| Patti | 2 | Patti - Villaggio Ruffini |
| Sferracavallo | 2 | Sferracavallo |
| Tommaso Natale | 2 | Tommaso Natale - Sant'Ambrogio - Cardillo |
| Uditore | 2 | Uditore |
| Vergine Maria | 2 | Vergine Maria |
| Villagrazia | 2 | Villagrazia |
| Addaura | 1 | Partanna Mondello |
| Mondello | 1 | Partanna Mondello |
| Monte Pellegrino | 1 | Montepellegrino |
| Parco della Favorita | 1 | San Lorenzo |
| Partanna | 1 | Partanna Mondello |
| Quartiere Matteotti | 1 | Vittorio Veneto |
| Resuttana | 1 | Resuttana |
| San Lorenzo | 1 | San Lorenzo |
| Valdesi | 1 | Partanna Mondello |


## What the level does

- **Neighbourhood score** (`src/danger.js`, drawn by `src/danger-hud.js`). Nothing is random: every area keeps a score from 0 to 100 that only rises when you do damage in it, with the events that feed the police (`src/police.js` sends `pd-chaos` for each: cars sent flying, people knocked over, smashed fences, walls and hedges, fast driving through crowds and over pavements). Zero damage is zero risk, everywhere. The rates are in one table, `TUNE` at the top of the file:
  - touchiness by the area's level 1 to 5 (points per unit of police chaos, a car sent flying is 0.7 units, a person knocked over 0.45): 2, 6, 12, 24, 46. In cars sent flying that is about 43 to reach "searching" in level 1, 14 in level 2, 7 in level 3, 4 in level 4 and 2 in the ZEN;
  - each kind counts as in the police except fast driving through crowds and over pavements (0.35, they come as a stream) and hitting the police (0.5); at night everything counts 1.3 times;
  - stages: calm under 35 points (diamonds only, 20 points a diamond), noticed from 35 ("Ti stannu taliannu…", full bar), searching from 60 (the bar drains, "Ti stannu circannu!"), get out when the bar is under 35% ("Nesci ri ccà!", lookouts shout), and the bar empty in that area means the gang block;
  - the bar lasts 40 s at cruising speed; the old speed factor still applies: 3 times faster when stopped, 2 under 6 m/s, 1 under 14, 0.35 above (flooring it is safer). Not during an event, a transition or the busted card;
  - leaving the area before the bar is empty is safe ("Saibbatu!" for a moment). The bar of an area you are not in fills again in 12 s;
  - a score starts to fade 8 s after the last damage, 0.5 points a second, in every area (so it is remembered for a minute or two if you come back); it does not fade while you are parked in an area at "noticed" or worse;
  - after a block the score of that area is 0.
  The old random dice (`RATE`, `blockRate`, the 3 s check, the 120 s cooldown) are gone. The lookouts are the scooters of the normal traffic near you (up to two in view within 45 m; `pd-lookout`, src/traffic.js); with none in sight one balloon from the roadside ahead.
- **The block**: the screen darkens for about 3 s, goes black, and you wake up on a road just outside the area (no cell of it within 35 m, preferring a lower level, nearest first), facing away, stripped to the frame for five minutes of play (cosmetic only), minus some cash.
- **Cash lost**: a share of the wallet, at least and at most, never more than you have: level 2 8% (min 3, max 15), level 3 15% (6, 30), level 4 25% (10, 60), level 5 40% (15, 120), all in euro. Shown in the wake-up toast.
- **Police** (`src/police.js`): the calm-streets patrol check (every 25 to 55 s) spawns a car with chance 1, 0.75, 0.45, 0.15, 0.03 for levels 1 to 5. Chases once you cause chaos are unchanged.
- **The capsule** (top right, same on a phone and a desktop): the area's name, its level as a small number, and five diamonds that fill as the area's score rises, tinted by the level (green to red). From "noticed" a row appears under them in the look of the police row: the words and a bar. The police row stays under it.

## Test links

- `?danger=1..5` forces the level everywhere (touchiness, police, tint).
- `?dangerscore=N` starts with N points in the area you start in (35 noticed, 60 searching).
- `?dangerfast` makes the bar last 5 s and plays the block sequence at 15% length; `?dangerfast=1` the real-length sequence. With `?debug`, `window.pdDanger = { add(points), set(points), state(), areas }` (points, not police units) and `window.pdPolice.chaos('yeet')` sends the real event.
- `?dangerfreeze=fade|black|wake&dangerk=0.5` freezes the sequence half way through a stage (screenshots).
- `?policefast` runs the patrol check 20 times as often; with `?debug`, `window.pdPolice.stat` holds `{ rolls, spawns }`.
- `?evlog` logs the block stages to the console.

## Rebuild

`python3 -I tools/danger.py PATH/Palermo.html [--table]` (the file is in ISTAT's `R19_Sicilia_IDISE_2023` release, `Palermo.html`). The levels live in the `u(...)` table at the top of the script.
