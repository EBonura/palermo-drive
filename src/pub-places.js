// The pubs of the night life (src/pubs.js builds them, src/event-pubs.js runs their errands). One record per venue; the research behind each one
// (address, OSM node, what the front looks like, opening hours) is in docs/pubs.md. `node assets/missions/snap-pubs.mjs` reads this file and bakes
// src/pub-routes.js: the facade point and its outward normal (from the building footprints), the road point for the lapa, and the errand items.
// Italian first, English second, as in the rest of the game. Lat/lon are OpenStreetMap points (10 to 20 m of error), `along` shifts the door sideways
// along the facade (metres, + is to the right as seen from the street) when the photos say the door is somewhere else.
//
//   front      key of the facade drawn by src/pub-fronts.js
//   open       [from, to] game hours with people outside and the shutter up (to < from wraps over midnight)
//   crowd      { mix, night, day, r }  spawnCrowd() mix and head counts (night = open hours, day = the rest of the day), r = radius in metres
//   music      id of a file in assets/music played near the door (Krust only)
//   errand     the night-only event: window [from, to] game hours, what is lost, how many, lines
//
// No fabricated facts: names, addresses and sign texts come from docs/pubs.md; the lines are the game's own jokes.

export const ITEMS = {
  moretti: { it: 'casse di Moretti', en: 'crates of Moretti', one: ['una cassa', 'a crate'], shape: 'crate' },
};

export const PUBS = [
  {
    id: 'krust', name: 'Krust', sub: 'Via Dante 19', real: true,
    lat: 38.1243791, lon: 13.3528857, src: 'OpenStreetMap node 5410425438 (amenity=bar, name=Krust); street number from the venue pages',
    front: 'krust', open: [19, 3],
    crowd: { mix: { metal: 0.7, night: 0.3 }, props: 'beer', night: 10, day: 4, r: 3.4 },
    music: 'terrorage',
    errand: {
      item: 'moretti', n: 8, window: [18, 6], who: 'Vincenzo', pay: 2.5, bonus: 12,
      call: [['Ao! Mi hanno rubato le casse di Moretti! Aiutami!', 'Hey! Someone stole my Moretti crates! Help me!'], ['Fermati! Serve birra, la serata è lunga!', 'Stop! We need beer, the night is long!'], ['Lapista! Le casse di Moretti sono sparite!', 'Driver! The Moretti crates are gone!']],
      start: ['Cerca le casse di Moretti!', 'Find the Moretti crates!'],
      thanks: [['Sei un mito! Stasera la birra è gratis, per te!', 'You are a legend! Tonight the beer is on the house, for you!'], ['\\m/ Sali a bere, picciotto!', '\\m/ Come in and drink, kid!']],
      none: [['Niente?! Senza Moretti il metal è solo rumore.', 'Nothing?! Without Moretti metal is just noise.']],
    },
  },
];
