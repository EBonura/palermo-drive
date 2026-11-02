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

// art: the Italian article for "Cerca ...!"; shape: drawn by src/event-pubs.js
export const ITEMS = {
  moretti: { it: 'casse di Moretti', en: 'crates of Moretti', art: 'le', shape: 'crate' },
  whisky: { it: 'bottiglie di whisky', en: 'bottles of whisky', art: 'le', shape: 'bottle' },
  fiaschi: { it: 'fiaschi di Sangue di Sicilia', en: 'flasks of Sangue di Sicilia', art: 'i', shape: 'flask' },
  dischi: { it: 'dischi in vinile', en: 'vinyl records', art: 'i', shape: 'vinyl' },
  fusti: { it: 'fusti di birra', en: 'beer kegs', art: 'i', shape: 'keg' },
  chitarre: { it: 'chitarre', en: 'guitars', art: 'le', shape: 'guitar' },
  boccali: { it: 'boccali di birra', en: 'beer mugs', art: 'i', shape: 'mug' },
  barili: { it: 'barili dei tavoli', en: 'table barrels', art: 'i', shape: 'barrel' },
};

// Start-map and list points of interest that are not a pub: [name, lat, lon], appended to SPOTS in src/main.js (see the report of the pubs work).
export const POI_SPOTS = [
  ['Piazza Magione', 38.113241, 13.369435],
  // b2: Sferracavallo (already inside the baked area, west of Mondello; the quartiere centre in main.js names the picker group): the square and the harbour, on OSM road points
  ['Sferracavallo (la piazza)', 38.198219, 13.276741],
  ['Sferracavallo (il porticciolo)', 38.199316, 13.276098],
];

export const PUBS = [
  {
    id: 'krust', name: 'Krust', sub: 'Via Dante 19', real: true,
    lat: 38.1243791, lon: 13.3528857, src: 'OpenStreetMap node 5410425438 (amenity=bar, name=Krust); street number from the venue pages',
    front: 'krust', open: [19, 3],
    crowd: { mix: { metal: 0.7, night: 0.3 }, props: 'beer', night: 10, day: 4, r: 3.4 },
    music: 'terrorage', musicInfo: { label: 'KRUST', title: 'DIY Violence', artist: 'Terrorage' },
    errand: {
      item: 'moretti', n: 8, window: [18, 6], who: 'Vincenzo', pay: 2.5, bonus: 12,
      call: [['Ao! Mi hanno rubato le casse di Moretti! Aiutami!', 'Hey! Someone stole my Moretti crates! Help me!'], ['Fermati! Serve birra, la serata è lunga!', 'Stop! We need beer, the night is long!'], ['Lapista! Le casse di Moretti sono sparite!', 'Driver! The Moretti crates are gone!']],
      start: ['Cerca le casse di Moretti!', 'Find the Moretti crates!'],
      thanks: [['Sei un mito! Stasera la birra è gratis, per te!', 'You are a legend! Tonight the beer is on the house, for you!'], ['\\m/ Sali a bere, picciotto!', '\\m/ Come in and drink, kid!']],
      none: [['Niente?! Senza Moretti il metal è solo rumore.', 'Nothing?! Without Moretti metal is just noise.']],
    },
  },

  // ---- Via Carducci, round the corner from Krust: an ochre palazzo, a pink neon board, a sunburst fanlight over the door, a terrace of cream parasols
  {
    id: 'whisky', name: 'Whisky & Drink', sub: 'Via Carducci 38', real: true,
    lat: 38.1245025, lon: 13.3526089, onStreet: 'Carducci', src: 'OpenStreetMap node 269241275 (amenity=bar, addr:housenumber=36); the signed address is Via Carducci 38',
    front: 'whisky', open: [17, 2],
    crowd: { mix: { young: 0.6, night: 0.4 }, props: 'beer', night: 9, day: 2, r: 3 },
    caller: 'nightboy2',
    errand: {
      item: 'whisky', n: 8, window: [18, 6], who: 'Sasà', pay: 2.5, bonus: 12,
      call: [['Minchia, mi sono spariti i cartoni di whisky dal furgone!', 'Damn, the cases of whisky vanished off my van!'], ['Ao! Il corriere le ha perse per strada! Aiutami!', 'Hey! The courier dropped them on the road! Help me!'], ['Lapista! Senza whisky la birreria è un\'acqua minerale!', 'Driver! Without whisky this place is a mineral water bar!']],
      start: ['Cerca le bottiglie di whisky!', 'Find the whisky bottles!'],
      thanks: [['Ti offro un bicchierino, ma uno solo!', 'I\'ll buy you a shot, but only one!'], ['Sei un grande! Stasera si brinda!', 'You are great! Tonight we toast!']],
      none: [['Niente? Stasera si beve acqua del rubinetto.', 'Nothing? Tonight it is tap water.']],
    },
  },
  // ---- the Vucciria lane: carved MAGGIORE over a turquoise shopfront, a blue awning, a lane packed shoulder to shoulder. Real hours end at 22:00, the game's errand does not.
  {
    id: 'taverna', name: 'Taverna Azzurra', sub: 'Discesa dei Maccheronai 9', real: true,
    lat: 38.1176395, lon: 13.363446, src: 'OpenStreetMap node 4622670991 (amenity=bar, addr:housenumber=9)',
    front: 'taverna', open: [10, 23],
    crowd: { mix: { young: 0.55, night: 0.45 }, props: 'beer', night: 12, day: 4, r: 2.6 },
    caller: 'vendor2',
    errand: {
      item: 'fiaschi', n: 8, window: [18, 6], who: 'Pietro', pay: 2.5, bonus: 12,
      call: [['Aiuto! Mi sono caduti i fiaschi di Sangue di Sicilia dal carretto!', 'Help! My flasks of Sangue di Sicilia fell off the cart!'], ['Ci vediamo in Taverna... ma senza vino non c\'è Taverna!', 'See you at the Taverna... but with no wine there is no Taverna!'], ['Ao! Il vino dolce sta rotolando per tutta la città!', 'Hey! The sweet wine is rolling all over town!']],
      start: ['Cerca i fiaschi di Sangue di Sicilia!', 'Find the Sangue di Sicilia flasks!'],
      thanks: [['Sei un angelo! Ti riservo un bicchiere di Zibibbo!', 'You are an angel! I will keep a glass of Zibibbo for you!'], ['Salvata la serata! Vieni in Taverna, offro io!', 'Evening saved! Come to the Taverna, it is on me!']],
      none: [['Nenti? Mi toccherà vendere l\'acqua...', 'Nothing? I will have to sell water...']],
    },
  },
  // ---- Via Napoli: a record shop with a bar, a black sign box, gig posters on the glass, a deck
  {
    id: 'punkfunk', name: 'PunkFunk', sub: 'Via Napoli 10', real: true,
    lat: 38.1179257, lon: 13.3626883, src: 'OpenStreetMap node 12059526269 (amenity=bar, addr:housenumber=10)',
    front: 'punkfunk', open: [17, 1],
    crowd: { mix: { night: 0.45, metal: 0.25, young: 0.3 }, props: 'beer', night: 9, day: 2, r: 3 },
    caller: 'dj',
    errand: {
      item: 'dischi', n: 8, window: [18, 6], who: 'Il DJ', pay: 2.5, bonus: 12,
      call: [['Ao! Mi è volata via la cassa dei dischi! Sono 33 giri, non frisbee!', 'Hey! My box of records flew off! They are LPs, not frisbees!'], ['Aiuto! I vinili del Record Store Day sono spariti!', 'Help! The Record Store Day vinyls are gone!'], ['Senza dischi stasera c\'è solo il silenzio!', 'Without records tonight there is only silence!']],
      start: ['Cerca i dischi in vinile!', 'Find the vinyl records!'],
      thanks: [['Rock! Stasera il primo giro lo offro io!', 'Rock! The first round tonight is on me!'], ['Sei il mio roadie preferito!', 'You are my favourite roadie!']],
      none: [['Niente dischi? Allora suoniamo a cappella.', 'No records? Then we play a cappella.']],
    },
  },
  // ---- Piazza Magione: the lawn and the steps are never empty; the Whisky and Drink Magione bar stands on the piazza. The record is the lawn (the crowd sits there), the
  // front is the bar on the facade nearest to it that looks at it.
  {
    id: 'magione', name: 'Piazza Magione', sub: 'Kalsa', real: true, scene: true,
    lat: 38.113241, lon: 13.369435, src: 'the lawn of the piazza as drawn in the game (the OSM point of the Whisky and Drink Magione shop is only approximate); crowd and bar after docs/pubs.md section 8',
    front: 'wdmagione', open: [0, 24],
    crowd: { mix: { young: 1 }, props: 'beer', night: 18, day: 14, r: 8, pose: 'sit', anywhere: true, atVenue: true },
    caller: 'nightgirl2',
    errand: {
      item: 'fusti', n: 7, window: [18, 6], who: 'Gigi', pay: 2.5, bonus: 12,
      call: [['Ao! I fusti mi sono rotolati via per tutta la piazza!', 'Hey! The kegs rolled away across the whole piazza!'], ['Aiuto! Il prato è asciutto, senza fusti!', 'Help! The lawn is dry without the kegs!'], ['Lapista! Recuperami i fusti di birra!', 'Driver! Get my beer kegs back!']],
      start: ['Cerca i fusti di birra!', 'Find the beer kegs!'],
      thanks: [['Sei un grande! Siediti sul prato e bevi!', 'You are great! Sit on the lawn and drink!'], ['Evviva! La piazza è salva!', 'Hooray! The piazza is saved!']],
      none: [['Niente fusti? Allora si beve acqua sul prato.', 'No kegs? Then we drink water on the lawn.']],
    },
  },

  // ---- Via Grande Lattarini: one opening with a roller-shutter box, a black fascia with "LIZARD" in chalky hand-drawn capitals, cream FORST parasols on the lane
  {
    id: 'lizard', name: 'Lizard', sub: 'Via Grande Lattarini 22', real: true,
    lat: 38.1157014, lon: 13.364589, onStreet: 'Lattarini', src: 'OpenStreetMap node 10737357579 (amenity=pub, addr:housenumber=22); front after the Restaurant Guru night photo (June 2023), docs/pubs.md section 5',
    front: 'lizard', open: [17, 2],
    crowd: { mix: { young: 0.5, night: 0.35, tourists: 0.15 }, props: 'beer', night: 10, day: 2, r: 2.8 },
    caller: 'nightgirl3',
    errand: {
      item: 'chitarre', n: 8, window: [18, 6], who: 'Il batterista', pay: 2.5, bonus: 12,
      call: [['Ao! Il furgone della band ha perso le chitarre per strada!', 'Hey! The band\'s van dropped the guitars on the road!'], ['Aiuto! Stasera c\'è il concerto e le chitarre sono sparite!', 'Help! Tonight is the gig and the guitars are gone!'], ['Lapista! Senza chitarre è solo karaoke!', 'Driver! Without guitars it is just karaoke!']],
      start: ['Cerca le chitarre!', 'Find the guitars!'],
      thanks: [['Ti metto in lista, entri gratis per sempre!', 'I will put you on the list, you get in free forever!'], ['Sei il nostro roadie! Un applauso!', 'You are our roadie! A round of applause!']],
      none: [['Niente chitarre? Allora stasera si fa il silenzio.', 'No guitars? Then tonight we do silence.']],
    },
  },
  // ---- Piazza Sant'Anna: a narrow ochre doorway with peeling plaster, barrel-top tables against the wall, the whole piazza turns into an open-air pub at night
  {
    id: 'monkey', name: 'Monkey', sub: 'Piazza Sant\'Anna 19', real: true,
    lat: 38.1149842, lon: 13.3653171, src: 'OpenStreetMap node 3396245909 (amenity=bar, addr:housenumber=19); front after docs/pubs.md section 6',
    front: 'monkey', open: [10, 2],
    crowd: { mix: { young: 0.5, night: 0.3, tourists: 0.2 }, props: 'beer', night: 12, day: 3, r: 4 },
    caller: 'ragazzo2',
    errand: {
      item: 'barili', n: 8, window: [18, 6], who: 'Il cameriere', pay: 2.5, bonus: 12,
      call: [['Ao! I barili dei tavoli sono rotolati giù per la piazza!', 'Hey! The table barrels rolled down the piazza!'], ['Aiuto! Il Monkey è senza tavoli, riportami i barili!', 'Help! The Monkey has no tables, bring me the barrels!'], ['Lapista! Non si può bere in piedi tutta la sera!', 'Driver! You cannot drink standing up all evening!']],
      start: ['Cerca i barili dei tavoli!', 'Find the table barrels!'],
      thanks: [['Grazie! Ti porto una Paulaner, offre la casa!', 'Thanks! I will bring you a Paulaner, on the house!'], ['Sei un mito! I tavoli sono salvi!', 'You are a legend! The tables are saved!']],
      none: [['Niente barili? Stasera si beve in piedi.', 'No barrels? Tonight we drink standing.']],
    },
  },
  // ---- San Lorenzo, far to the north: a converted market hall behind a dark glazed front, thin white serif capitals "SANLORENZO / MERCATO", warm light and string lights
  {
    id: 'sanlorenzo', name: 'Sanlorenzo Mercato', sub: 'Via San Lorenzo 288', real: true,
    lat: 38.1653202, lon: 13.3176098, onStreet: 'San Lorenzo', src: 'OpenStreetMap node 9201943017 (amenity=food_court); front after docs/pubs.md section 4',
    front: 'sanlorenzo', open: [11, 24],
    crowd: { mix: { locals: 0.4, young: 0.4, tourists: 0.2 }, props: 'beer', night: 12, day: 4, r: 3.4 },
    caller: 'vendor',
    errand: {
      item: 'boccali', n: 8, window: [18, 6], who: 'Il birraio', pay: 2.5, bonus: 12,
      call: [['Aiuto! I boccali sono finiti per strada, e ne servono trecento al giorno!', 'Help! The mugs ended up on the road, and we need three hundred a day!'], ['Ao! Senza boccali la birra artigianale non si serve!', 'Hey! Without mugs the craft beer cannot be served!'], ['Lapista! Mi hanno portato via i boccali dal carrello!', 'Driver! They took the mugs off my cart!']],
      start: ['Cerca i boccali di birra!', 'Find the beer mugs!'],
      thanks: [['Sei un tesoro! Stasera la prima birra è per te!', 'You are a treasure! Tonight the first beer is yours!'], ['Salvati i boccali! Brindiamo al Mercato!', 'Mugs saved! A toast to the Mercato!']],
      none: [['Niente boccali? Si beve dalla bottiglia, allora.', 'No mugs? Then we drink from the bottle.']],
    },
  },
];
