// Where the stops of the friend ideas stand (Nov 2026): the Ganci branches ("Pezzo nni Ganci"), the prayer stops of Santa Rosalia ("A preghiera alla santuzza"), the night cornetto kiosks
// ("Cornetto i menzannuatti"). Built by src/friend-stops.js; the lines are in assets/missions/lines.js (GANCI, PREGHIERA, CORNETTO). The corsa illegale chi cavaddi is RACES in src/event-places.js and the
// stigghiolaro under the Basile bridge is STIGGHIOLA_FAR in assets/missions/lines.js. Sources and doubts: docs/friend-places.md.
// lat/lon is where the STAND is, not the address: each was placed on the kerb of the named street by tools of the world tiles (a free paved spot, outside the building footprints, clear of every lane), and
// (rx, rz) is the unit direction from the stand to the street. The house numbers are not in OpenStreetMap, so where a street is long the position along it is a choice (`sure` says how much).

// ---- "Pezzo nni Ganci": one stop per branch of the Ganci rosticceria that a source confirms. sign/sub: the text of the sign (a plain name, nothing else of the real shop).
// Branches taken from the shop's own site (gancisicilianfood.it, read 4 Nov 2026): Via Francesco Crispi 104, Largo Salvatore Caronia Roberti (Addaura), Via Thaon di Revel 56, Via Brunelleschi 66,
// Via Cala 120. Via Rocco Jemma 8: Apple Maps place "Ganci Cornetteria Rosticceria" (maps.apple.com place I6A96A8024CF75068) and the oraridiapertura24.it listing. Caffe Ganci e Figli: OpenStreetMap node
// 5057886471, Via Aurelio Drago. NOT built: Via Thaon di Revel 56 (the street is neither in OpenStreetMap nor in the world tiles, so there is no road to put it on), Via Torre di Mondello 10,
// Via Malaspina 121 and Via Corselli 12 (no source found that confirms them: the Just Eat and PalermoToday pages could not be read, and no other page names them).
export const GANCI_SITES = [
  { id: 'cala', addr: 'Via Cala 120', street: 'Via della Cala', sign: 'GANCI', sub: 'ROSTICCERIA', lat: 38.119592, lon: 13.369889, rx: -0.456, rz: -0.890, sure: 'street sure, position along it a guess (house number not on the map)', src: 'gancisicilianfood.it; Via della Cala from OSM Nominatim' },
  { id: 'crispi', addr: 'Via Francesco Crispi 104', street: 'Via Francesco Crispi', sign: 'GANCI', sub: 'ROSTICCERIA', lat: 38.121252, lon: 13.366175, rx: -0.947, rz: 0.322, sure: 'street sure, position along it a guess', src: 'gancisicilianfood.it; Nominatim puts the street at 38.1219, 13.3657 (La Loggia)' },
  { id: 'addaura', addr: 'Largo Salvatore Caronia Roberti, Addaura', street: 'Lungomare Cristoforo Colombo', sign: 'GANCI', sub: 'ROSTICCERIA', lat: 38.190909, lon: 13.344289, rx: 0.647, rz: -0.763, sure: 'fair: the square is not in OSM, the bus stop named after it is (Nominatim 38.19089, 13.34428, Lungomare Cristoforo Colombo)', src: 'gancisicilianfood.it; bus stop "Cristoforo Colombo - Caronia Roberti" (Nominatim)' },
  { id: 'brunelleschi', addr: 'Via Brunelleschi 66', street: 'Via Filippo Brunelleschi', sign: 'GANCI', sub: 'ROSTICCERIA', lat: 38.138089, lon: 13.313837, rx: -0.990, rz: -0.143, sure: 'street fair (the one in Inserra, Palermo; Nominatim has no plain "Via Brunelleschi" there), position along it a guess', src: 'gancisicilianfood.it; Nominatim: Via Filippo Brunelleschi, Inserra' },
  { id: 'jemma', addr: 'Via Rocco Jemma 8 (Policlinico)', street: 'Via Rocco Jemma', sign: 'GANCI', sub: 'ROSTICCERIA', lat: 38.105062, lon: 13.362776, rx: 0.576, rz: -0.817, sure: 'street sure, the end towards the Policlinico (number 8 is a low number)', src: 'Apple Maps place I6A96A8024CF75068; oraridiapertura24.it' },
  { id: 'drago', addr: 'Via Aurelio Drago', street: 'Via Aurelio Drago', sign: 'GANCI & FIGLI', sub: 'CAFFÈ', lat: 38.105130, lon: 13.331736, rx: -0.993, rz: 0.118, sure: 'sure (the OSM node is 6 m from the stand); whether it is the same family as the Ganci above is not known', src: 'OpenStreetMap node 5057886471 "Caffe Ganci e Figli", Nominatim 2026-11-04' },
];

// ---- "A preghiera alla santuzza": the shrine at the foot of the stair of the Santuario di Santa Rosalia (src/lmc-a.js, the building stands at -825,-5780; the stair comes down to the end of the service
// road at about -842,-5787, where the pollanche cart is). It is a small wayside shrine drawn in code. Prayer stops share one cooldown (COOL_S).
export const SANTUZZA = { id: 'santuario', name: 'Santuario di Santa Rosalia', lat: 38.168063, lon: 13.351605, rx: 1, rz: 0, src: 'the service road end in front of the Santuario (world tiles); the landmark src/lmc-a.js', sure: 'fair: the shrine is ours, the place is the foot of the real stair' };
export const COOL_S = 300;   // seconds before the next blessing (a design choice, to tune by playing)
export const PRAY_S = 2.4;   // seconds standing still in the ring
// The carro (the Festino float of Santa Rosalia) drawn as a landmark with its own prayer stop. The real carro is NOT here: the owner said "just put it somewhere visible" (4 Nov 2026) and the
// friend's "always in the usual place" was not found. Where the sources put the real one: Piazza Marina in front of Palazzo Galletti (2021, blogsicilia.it), Foro Umberto I (to July 2024), then
// Via Matteo Bonello beside the Cattedrale (from July 2024, balarm.it, palermotoday.it, artribune.com 2026). This one stands on the Foro Italico lawn, where the Festino ends. `on` false takes it away.
// (rx, rz): the direction from the carro to Foro Italico Umberto I, 19 m away (its long side faces the road and its prayer ring is on the dirt strip beside it).
export const CARRO = { on: true, id: 'carro', name: 'Carro di Santa Rosalia', lat: 38.117952, lon: 13.373192, rx: -0.83, rz: 0.55, src: 'invented spot on the Foro Italico lawn (Festino route: Cattedrale, Corso Vittorio Emanuele, Porta Felice, Foro Italico)' };

// ---- "Cornetto i menzannuatti": kiosks that sell hot cornetti, open only from CORNETTO_HOURS[0] to [1] (game hours, wrapping midnight). Shuttered the rest of the day: no seller, no queue, no stop, no pin.
// Both places come from the owner (4 Nov 2026). tribunale: "At Cornetteria Chioschetto Court", which the listings (seeker.io, restaurantguru.com, parrocchiamadonnadipompei.it, caffe-ristorante-bar.it) put at
// Via Costantino Lascaris 10, 90138 Palermo. That street starts at Piazza Porta Guccia on Corso Alberto Amedeo (the kiosk's Facebook page says "Piazzetta Porta Guccia", vacanzesiciliane.net says Corso Alberto
// Amedeo 182, "a pochi passi dal tribunale"), so number 10 is its eastern end, about 130 m from the Palazzo di Giustizia (src/lmc-d.js). Not "behind" the building: no source says that.
// cornuit: the owner's own address, Gastronomia Cornuit, Via Giuseppe Lanza di Scalea 338-342, Palermo (90146, San Lorenzo; virgilio.it, twopos.it, cylex-italia.it agree). Nominatim has the street but not the
// numbers and OpenStreetMap has no feature for it, so the stand is on that street at the point nearest to the coordinate that Virgilio gives for the address (38.167, 13.3167).
export const CORNETTO_HOURS = [23.5, 6];
export const CORNETTI = [
  { id: 'tribunale', name: 'At Cornetteria Chioschetto Court', sign: 'AT CORNETTERIA CHIOSCHETTO COURT', lat: 38.117365, lon: 13.350512, rx: 0.074, rz: 0.997, sure: 'street sure; number 10 is a low number, so the east end of Via Costantino Lascaris', src: 'seeker.io/place/i1_Pn90J7 (Via Costantino Lascaris 10); Nominatim: Via Costantino Lascaris' },
  { id: 'cornuit', name: 'Gastronomia Cornuit', sign: 'CORNUIT', lat: 38.166962, lon: 13.316626, rx: 0.843, rz: -0.539, sure: "the owner's address; the point along the street is the one nearest to the Virgilio coordinate", src: 'owner; aziende.virgilio.it/ristoranti/palermo-pa/cornuit (Via Lanza di Scalea 338, 38.167, 13.3167)' },
];
