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
// No fabricated facts: names, addresses and sign texts come from docs/pubs.md; the lines are the game's own jokes. The one exception is marked real: false
// (Dal polacco): a friend's in-joke placed on the owner's request, not a venue, and its src says so.

// art: the Italian article for "Cerca ...!"; shape: drawn by src/event-pubs.js
export const ITEMS = {
  moretti: { it: 'casci ri Moretti', en: 'crates of Moretti', art: 'le', shape: 'crate' },
  whisky: { it: 'buttigghi ri whisky', en: 'bottles of whisky', art: 'le', shape: 'bottle' },
  fiaschi: { it: 'fiaschi ri Sangue ri Sicilia', en: 'flasks of Sangue di Sicilia', art: 'i', shape: 'flask' },
  dischi: { it: 'dischi ’n vinili', en: 'vinyl records', art: 'i', shape: 'vinyl' },
  fusti: { it: 'fusti ri birra', en: 'beer kegs', art: 'i', shape: 'keg' },
  chitarre: { it: 'chitarre', en: 'guitars', art: 'le', shape: 'guitar' },
  boccali: { it: 'buccali ri birra', en: 'beer mugs', art: 'i', shape: 'mug' },
  barili: { it: 'varrili ri tavuli', en: 'table barrels', art: 'i', shape: 'barrel' },
  polacca: { it: 'casci ri birra polacca', en: 'crates of Polish beer', art: 'le', shape: 'pcrate' },   // DRAFT (Dal polacco)
  birre: { it: 'buttigghi ri birra', en: 'beer bottles', art: 'le', shape: 'beer' },   // DRAFT (Drunks)
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
      call: [['Ao! M’arrubbaru i casci ri Moretti! Aiutami!', 'Hey! Someone stole my Moretti crates! Help me!'], ['Fermati! Ci vo a birra, a serata è longa!', 'Stop! We need beer, the night is long!'], ['Lapista! I casci ri Moretti sunnu scumparsi!', 'Driver! The Moretti crates are gone!']],
      start: ['Attruova i casci ri Moretti!', 'Find the Moretti crates!'],
      thanks: [['Sì ’nu mitu! Stasira a birra è gratis, pi tia!', 'You are a legend! Tonight the beer is on the house, for you!'], ['\\m/ Acchiana a viviri, picciotto!', '\\m/ Come in and drink, kid!']],
      none: [['Nianti?! Sienza Moretti u metal è sulu rumuri.', 'Nothing?! Without Moretti metal is just noise.']],
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
      call: [['Minchia, mi sunnu scumparsi i casci ri whisky râ furgunetta!', 'Damn, the cases of whisky vanished off my van!'], ['Ao! U currieri l’ha pirduti nta strata! Aiutami!', 'Hey! The courier dropped them on the road! Help me!'], ['Lapista! Sienza whisky a biriria è ’n’acqua minirali!', 'Driver! Without whisky this place is a mineral water bar!']],
      start: ['Attruova i buttigghi ri whisky!', 'Find the whisky bottles!'],
      thanks: [['Ti offru ’nu bicchierinu, ma unu sulu!', 'I\'ll buy you a shot, but only one!'], ['Sì ’nu granni! Stasira si brinna!', 'You are great! Tonight we toast!']],
      none: [['Nianti? Stasira si vivi acqua rû rubinettu.', 'Nothing? Tonight it is tap water.']],
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
      call: [['Aiutu! Mi sunnu cadduti i fiaschi ri Sangue ri Sicilia rû carrettu!', 'Help! My flasks of Sangue di Sicilia fell off the cart!'], ['Ni viremu â Taverna... ma sienza vinu un c’è Taverna!', 'See you at the Taverna... but with no wine there is no Taverna!'], ['Ao! U vinu duci sta ruzzuliannu pi tutta a città!', 'Hey! The sweet wine is rolling all over town!']],
      start: ['Attruova i fiaschi ri Sangue ri Sicilia!', 'Find the Sangue di Sicilia flasks!'],
      thanks: [['Sì ’n’angilu! Ti tegnu ’nu bicchieri ri Zibibbu!', 'You are an angel! I will keep a glass of Zibibbo for you!'], ['Saivata a serata! Veni â Taverna, offru iu!', 'Evening saved! Come to the Taverna, it is on me!']],
      none: [['Nianti? Mi tuccherà vinniri l’acqua...', 'Nothing? I will have to sell water...']],
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
      call: [['Ao! M’è vulata via a cascia ri dischi! Sunnu trentatrì giri, un frisbee!', 'Hey! My box of records flew off! They are LPs, not frisbees!'], ['Aiutu! I vinili rû Record Store Day sunnu scumparsi!', 'Help! The Record Store Day vinyls are gone!'], ['Sienza dischi stasira c’è sulu u silenziu!', 'Without records tonight there is only silence!']],
      start: ['Attruova i dischi ’n vinili!', 'Find the vinyl records!'],
      thanks: [['Rock! Stasira u primu giru u offru iu!', 'Rock! The first round tonight is on me!'], ['Sì u me roadie prifiritu!', 'You are my favourite roadie!']],
      none: [['Nianti dischi? Allura sunamu a cappella.', 'No records? Then we play a cappella.']],
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
      call: [['Ao! I fusti mi sunnu ruzzuliati pi tutta a chiazza!', 'Hey! The kegs rolled away across the whole piazza!'], ['Aiutu! U pratu è siccu, sienza fusti!', 'Help! The lawn is dry without the kegs!'], ['Lapista! Ricuperami i fusti ri birra!', 'Driver! Get my beer kegs back!']],
      start: ['Attruova i fusti ri birra!', 'Find the beer kegs!'],
      thanks: [['Sì ’nu granni! Assettati supra u pratu e vivi!', 'You are great! Sit on the lawn and drink!'], ['Evviva! A chiazza è saiva!', 'Hooray! The piazza is saved!']],
      none: [['Nianti fusti? Allura si vivi acqua supra u pratu.', 'No kegs? Then we drink water on the lawn.']],
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
      call: [['Ao! U furgoni râ band pirdìu i chitarre nta strata!', 'Hey! The band\'s van dropped the guitars on the road!'], ['Aiutu! Stasira c’è u cuncertu e i chitarre sunnu scumparsi!', 'Help! Tonight is the gig and the guitars are gone!'], ['Lapista! Sienza chitarre è sulu karaoke!', 'Driver! Without guitars it is just karaoke!']],
      start: ['Attruova i chitarre!', 'Find the guitars!'],
      thanks: [['Ti mettu nta lista, trasi gratis pi sempri!', 'I will put you on the list, you get in free forever!'], ['Sì u nostru roadie! ’Nu applausu!', 'You are our roadie! A round of applause!']],
      none: [['Nianti chitarre? Allura stasira si fa u silenziu.', 'No guitars? Then tonight we do silence.']],
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
      call: [['Ao! I varrili ri tavuli sunnu ruzzuliati ngiù pâ chiazza!', 'Hey! The table barrels rolled down the piazza!'], ['Aiutu! U Monkey è sienza tavuli, puaittami i varrili!', 'Help! The Monkey has no tables, bring me the barrels!'], ['Lapista! Un si po viviri ’n peri tutta a sira!', 'Driver! You cannot drink standing up all evening!']],
      start: ['Attruova i varrili ri tavuli!', 'Find the table barrels!'],
      thanks: [['Grazzi! Ti puaittu ’na Paulaner, offri a casa!', 'Thanks! I will bring you a Paulaner, on the house!'], ['Sì ’nu mitu! I tavuli sunnu saivi!', 'You are a legend! The tables are saved!']],
      none: [['Nianti varrili? Stasira si vivi ’n peri.', 'No barrels? Tonight we drink standing.']],
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
      call: [['Aiutu! I buccali sunnu finuti nta strata, e ni sieivunu trecientu ô iornu!', 'Help! The mugs ended up on the road, and we need three hundred a day!'], ['Ao! Sienza buccali a birra artigianali un si sieivi!', 'Hey! Without mugs the craft beer cannot be served!'], ['Lapista! M’annu puaittatu via i buccali rû carrellu!', 'Driver! They took the mugs off my cart!']],
      start: ['Attruova i buccali ri birra!', 'Find the beer mugs!'],
      thanks: [['Sì ’nu tisoru! Stasira a prima birra è pi tia!', 'You are a treasure! Tonight the first beer is yours!'], ['Saivati i buccali! Brinnamu ô Mircatu!', 'Mugs saved! A toast to the Mercato!']],
      none: [['Nianti buccali? Si vivi râ buttiglia, allura.', 'No mugs? Then we drink from the bottle.']],
    },
  },

  // ---- Via Corrado Lancia (Olivuzza), invented: a friend of the owner asked for "un pub con scritto 'Dal polacco'" always under his house at number 40.
  // Not a real bar and nothing about it is researched: the owner asked for it as the friend's in-joke. OSM has no house numbers on this street, so number 40 is a
  // guess (see src and docs/pubs.md section 13): the even side taken as the south one, numbers counted from the Via Imera end, about 140 m along the 173 m street.
  // Every line here is a DRAFT for the owner to correct.
  {
    id: 'polacco', name: 'Dal polacco', sub: 'Via Corrado Lancia 40', real: false,
    lat: 38.115549, lon: 13.3477082, onStreet: 'Corrado Lancia', src: 'invented: a friend\'s in-joke placed at his address on the owner\'s request, not a real bar. The door is a guess: OSM way 43055723 has no house numbers (node 7576050480, tagged Via Corrado Lancia 25, stands on Corso Tukory, 1.1 km away), so 40 is put on the south side (even numbers on the left walking away from Via Imera, as on Corso Finocchiaro Aprile nearby), on the frontage of building way 279324273, about 140 m from Via Imera',
    front: 'polacco', open: [17, 2],
    crowd: { mix: { locals: 0.55, young: 0.45 }, props: 'beer', night: 7, day: 2, r: 2.6 },
    caller: 'ragazzo',
    errand: {
      item: 'polacca', n: 8, window: [18, 6], who: 'Il polacco', pay: 2.5, bonus: 12,
      call: [['Ao! Mi sunnu scumparsi i casci ri birra polacca! Aiutami!', 'Hey! My crates of Polish beer have vanished! Help me!'], ['Lapista! Sutta casa c’è sempri u pub, ma stasira un c’è a birra!', 'Driver! There is always a pub under the house, but tonight there is no beer!'], ['Fermati! U furgunettu ra Polonia pirdìu tuttu nta strata!', 'Stop! The van from Poland dropped everything on the road!']],
      start: ['Attruova i casci ri birra polacca!', 'Find the crates of Polish beer!'],
      thanks: [['Na zdrowie! Stasira a prima birra a offru iu!', 'Na zdrowie! Tonight the first beer is on me!'], ['Si ’nu frati! Dal polacco a puaitta è sempri aperta pi tia!', 'You are a brother! At Dal polacco the door is always open for you!']],
      none: [['Nianti? Allura stasira si brinna câ gazzosa.', 'Nothing? Then tonight we toast with lemon soda.']],
    },
  },

  // ---- Piazza Sant'Anna 11, a few doors from Monkey (docs/pubs.md section 9): an ochre-orange palazzo with an iron balcony, a cream scalloped awning over the
  // ground floor, a black board with "drunks" hand-lettered in yellow outline, glass windbreak screens, high stools on the cobbles. Known for its one-euro shots.
  // Added on the owner's request (21 Nov 2026). Every line is a DRAFT for the owner to correct.
  {
    id: 'drunks', name: 'Drunks', sub: 'Piazza Sant\'Anna 11', real: true,
    lat: 38.1147289, lon: 13.3650293, src: 'OpenStreetMap node 10735085647 (Piazza Sant\'Anna 11, Tu-Su 18:00-02:30); front after docs/pubs.md section 9',
    front: 'drunks', open: [18, 3],
    crowd: { mix: { young: 0.6, night: 0.25, tourists: 0.15 }, props: 'beer', night: 11, day: 2, r: 3.2 },
    caller: 'nightboy2',
    errand: {
      item: 'birre', n: 8, window: [18, 6], who: 'Il barista', pay: 2.5, bonus: 12,
      call: [['Ao! U furgone ri birra s’apriu e i buttigghi sunnu pi tutta a chiazza!', 'Hey! The beer van opened and the bottles are all over the piazza!'], ['Lapista! Sienza birra u Drunks un è cchiù u Drunks!', 'Driver! Without beer Drunks is not Drunks any more!'], ['Aiutu! A birra a un euro finìu, attruovami i buttigghi!', 'Help! The one-euro beer ran out, find me the bottles!']],
      start: ['Attruova i buttigghi ri birra!', 'Find the beer bottles!'],
      thanks: [['Sì ’nu mitu! U primu shot è pi tia!', 'You are a legend! The first shot is on me!'], ['Saivata a serata! Brinnamu a Sant’Anna!', 'The night is saved! A toast to Sant’Anna!']],
      none: [['Nianti birra? Allura stasira shot r’acqua.', 'No beer? Then tonight it is water shots.']],
    },
  },

  // ---- Via San Lorenzo 273, a short way up the street from Sanlorenzo Mercato: Mind House, the Mind music factory's live club with studios and rehearsal rooms
  // in about 600 square metres "dal design industrial" (LiveSicilia and BlogSicilia, Nov 2025). No photo of the front was found, so it is drawn as an industrial
  // unit: grey render, a ribbed steel shutter, a black MIND HOUSE board, posters. Added on the owner's request (21 Nov 2026), his mission idea: "Aiuta Valerio
  // a recuperare i vinili". Every line is a DRAFT for the owner to correct.
  {
    id: 'mindhouse', name: 'Mind House', sub: 'Via San Lorenzo 273', real: true,
    lat: 38.167018, lon: 13.3159153, onStreet: 'San Lorenzo', src: 'OpenStreetMap node 13136276279 (Mind House, Via San Lorenzo 273); address in LiveSicilia and BlogSicilia; no photo of the front, drawn',
    front: 'mindhouse', open: [20, 3],
    crowd: { mix: { metal: 0.45, young: 0.4, night: 0.15 }, props: 'beer', night: 10, day: 1, r: 3.4 },
    caller: 'dj',
    errand: {
      item: 'dischi', n: 8, window: [18, 6], who: 'Valerio', pay: 2.5, bonus: 12,
      call: [['Ao! Aiuta a Valerio a ricupirari i vinili! Ciarreru ru furgone!', 'Hey! Help Valerio get his records back! They fell off the van!'], ['Lapista! Stasira c’è u dj set e i vinili sunnu ruzzuliati pi tutta a strata!', 'Driver! There is a DJ set tonight and the records rolled all down the street!'], ['Aiutu! Sienza vinili a Mind è muta!', 'Help! Without records the Mind is silent!']],
      start: ['Aiuta a Valerio a ricupirari i vinili!', 'Help Valerio get his records back!'],
      thanks: [['Grazzi! Pi tia l’ingressu è sempri aggratis!', 'Thanks! For you the entrance is always free!'], ['Saivati i vinili! U dj set ri stasira u dedicu a tia!', 'Records saved! Tonight’s DJ set is for you!']],
      none: [['Nianti vinili? Allura stasira sunamu i cassetti.', 'No records? Then tonight we play cassettes.']],
    },
  },
];
