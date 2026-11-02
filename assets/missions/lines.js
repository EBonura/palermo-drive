// Spoken lines for the "Turisti affamati" mode and the stigghiulari. Owned by the missions work.
// Tourists speak English with their nationality's clichés (en, us, de, jp, fr); the driver answers in Palermitan and Italian.
// Driver and vendor lines are [text, gloss] pairs: the gloss is only for the owner's review (assets/missions/lines.md,
// regenerate it with `node assets/missions/make-lines-md.mjs`). Tourist templates may use {place}, {food_en}, {food_de}, {food_fr}.

export const NATIONS = [['en', 3], ['us', 2], ['de', 2], ['jp', 2], ['fr', 1]];

// tourist lines by event, per nationality
export const TOURIST = {
  board: {
    en: ['Lovely! Is this a taxi or a moped with ambitions?', 'Oh, it is open at the back. Charming.', 'Is there a seatbelt? Hello? Seatbelt?'],
    us: ['Hey buddy! No Uber out here, so you are it!', 'Okay this is so authentic.'],
    de: ['Guten Tag! Wo ist der Sicherheitsgurt, bitte?', 'Pünktlich? Das werden wir sehen.'],
    jp: ['Konnichiwa! Sumimasen, we ride? Ok?', 'Sugoi! Small taxi, very cute!'],
    fr: ['Bonjour! Oh la la, une moto avec un toit?', 'On monte là-dedans? Vraiment?'],
  },
  ask: {
    en: ['Take us to {place}, please! We want {food_en}.', '{place}, driver! The guidebook says {food_en} will change our lives.'],
    us: ['Yo, {place}! I need {food_en}, my TikTok is waiting.', 'Take us to {place}. We are starving, it has been like two hours.'],
    de: ['Zu {place}, bitte! Wir möchten {food_de}.', 'Bitte nach {place}. Der Reiseführer sagt: {food_de}.'],
    jp: ['{place}, onegaishimasu! {food_en}, oishii!', 'We go {place}. {food_en}? Sugoi!'],
    fr: ['{place}, s\'il vous plaît! Nous voulons {food_fr}.', 'On va à {place}. On nous a dit {food_fr}!'],
  },
  fast: {
    en: ['That was fast! Is that allowed?', 'Slow down, I have just had a coffee!'],
    us: ['Whoa dude, is there a speed limit?!', 'This thing goes FAST!'],
    de: ['Nicht so schnell! Es gibt Regeln!', 'Sehr schnell. Zu schnell!'],
    jp: ['Hayai! Very fast! Kowai!', 'Sugoi speed!'],
    fr: ['Doucement! On n\'est pas pressés... enfin si.', 'Ça va vite, ça!'],
  },
  drift: {
    en: ['Why are we sideways?!', 'Is this a normal taxi? Is this normal?'],
    us: ['Oh my GOD we are sliding!', 'Is this a ride at Disney?'],
    de: ['Warum fahren wir quer?! Das ist nicht erlaubt!', 'Mein Gott, wir rutschen!'],
    jp: ['Kowai kowai kowai!', 'Sideways! Sugoi!'],
    fr: ['Mon Dieu, on dérape!', 'Mais on est de travers!'],
  },
  wheels: {
    en: ['We are on two wheels! TWO WHEELS!', 'Oh no oh no oh no, the other wheel!'],
    us: ['Two wheels!! Mom is gonna kill me!', 'Dude we are TILTED!'],
    de: ['Zwei Räder! Das ist verboten!', 'Wir kippen!'],
    jp: ['Two wheels! Sugoi! Camera, camera!', 'Kowai! Tilt!'],
    fr: ['Deux roues! C\'est de la folie!', 'On va se renverser!'],
  },
  miss: {
    en: ['He missed us by an inch!', 'Was that a bus? That was a bus.'],
    us: ['Dude, that was close! I am filming this!', 'Bro, did you see that?!'],
    de: ['Das war knapp! Sehr knapp!', 'Haben Sie den nicht gesehen?!'],
    jp: ['Abunai! Almost die!', 'Ah! Close close close!'],
    fr: ['C\'était à un cheveu!', 'Il nous a frôlés!'],
  },
  hitPed: {
    en: ['You hit someone! You hit a PERSON!', 'I am writing this on TripAdvisor.'],
    us: ['Did you just... dude. DUDE.', 'That is going on Yelp. And Google. And my mother.'],
    de: ['Sie haben jemanden getroffen! Ich rufe die Polizei!', 'Ich beschwere mich! Beim Konsulat!'],
    jp: ['Ah! Sumimasen sumimasen! Sorry sorry!', 'Daijoubu desu ka? Is he ok?'],
    fr: ['Vous avez touché quelqu\'un! Incroyable!', 'Je vais écrire au consulat!'],
  },
  hitWall: {
    en: ['That was a wall. A very old wall.', 'My neck! My neck!'],
    us: ['My insurance does NOT cover this!', 'Was that on purpose?'],
    de: ['Das war eine Wand! Eine WAND!', 'Mein Nacken!'],
    jp: ['Wall! Daijoubu desu ka? Wall is ok?', 'Itai! Ouch!'],
    fr: ['Le mur! Le mur!', 'Mon dos!'],
  },
  late: {
    en: ['We will never make lunch at this rate!', 'I am getting rather peckish, driver.'],
    us: ['I am getting hangry here! HANGRY!', 'Bro the food is not gonna eat itself.'],
    de: ['Wir sind spät. Pünktlichkeit ist wichtig!', 'Ich habe Hunger! Schneller bitte!'],
    jp: ['Isogi, isogi! Onaka suita! Hungry!', 'Hurry hurry, please!'],
    fr: ['On a faim, là! Vite!', 'Le déjeuner, c\'est sacré!'],
  },
  arrive: {
    en: ['Brilliant. Worst journey of my life. Five stars, nearly.', 'Keep the change. And my dignity, apparently.'],
    us: ['Five stars if you never do that again!', 'I am tipping you. Emotionally.'],
    de: ['Das war lebensgefährlich. Danke. Haben Sie eine Quittung?', 'Sehr... authentisch. Danke.'],
    jp: ['Arigato gozaimasu! Best roller coaster in Italy!', 'Sugoi taxi! Arigato!'],
    fr: ['C\'était terrifiant. On recommence demain?', 'Merci! Je crois que je suis vivant.'],
  },
  fail: {
    en: ['That is it, we are walking! One star!', 'We could have walked. Backwards.'],
    us: ['I am calling an Uber. It does not exist here but I am calling it!', 'Zero stars, my guy.'],
    de: ['Das war eine Katastrophe! Ich steige aus!', 'Wir laufen. Das geht schneller.'],
    jp: ['Sumimasen, we walk. Too slow. Gomen!', 'Mou ii! We go by foot!'],
    fr: ['C\'est fini, on descend!', 'On aurait dû prendre le bus. Ah non.'],
  },
  smell: {
    en: ['What is that smell?! Smells like heaven. Or a fire.', 'Is something burning? I want it.'],
    us: ['Dude what is THAT smell? I need that.', 'Is that a barbecue? Stop the thing!'],
    de: ['Was riecht denn hier so? Grillfleisch?', 'Das riecht fantastisch! Halten Sie an!'],
    jp: ['Sugoi smell! Meat? Fire? What is it?', 'Oishisou! Looks delicious! Stop, stop!'],
    fr: ['Quelle odeur! Arrêtez-vous!', 'Ça sent la fumée et le paradis.'],
  },
  eat: {
    en: ['Delicious. What is it? ...Intestines?! Oh. Oh well. More.', 'Mmm. Wait. Which part of the lamb?'],
    us: ['Dude, so good. Wait, it is WHAT?', 'Is this... guts? Honestly? Amazing.'],
    de: ['Lecker! ...Darm? Na gut. Noch eins.', 'Sehr gut. Aber ich will nicht wissen, was es ist.'],
    jp: ['Oishii! ...Intestine? Sugoi!', 'Itadakimasu! Oishii oishii!'],
    fr: ['Délicieux! ...Des boyaux? Bon. Encore.', 'C\'est bon. Ne me dites pas ce que c\'est.'],
  },
  ambient: {
    en: ['Is it always this hot?', 'Why is that scooter carrying a fridge?', 'Everyone is honking. Is someone getting married?', 'Do you take cards? No? ...Right.'],
    us: ['Do you guys have Apple Pay?', 'Is that guy riding a scooter with a whole family?', 'Does anyone here stop at red lights?'],
    de: ['Warum hupen alle? Ist jemand gestorben?', 'Hier gibt es keine Regeln, oder?', 'Parken in zweiter Reihe? Auf der Straße? Im Ernst?'],
    jp: ['Palermo is very... how to say... lively!', 'Many scooter. Many horn. Beautiful chaos!', 'Arigato! Everything is so loud!'],
    fr: ['Chez nous on dit bonne route. Ici on dit bonne chance.', 'Il fait trop chaud, je fonds.', 'Les feux rouges, c\'est une suggestion?'],
  },
};

// driver lines (Palermitan / Italian), [text, gloss for review]
export const DRIVER = {
  board: [
    ['Acchianati, acchianati! Amunì!', 'Climb in, climb in! Let\'s go!'],
    ['Bedda matri, quanti siti! Stringitivi, ca semu supra a lapa!', 'Holy Mother, how many of you! Squeeze in, this is a lapa! (?)'],
  ],
  depart: [
    ['Amunì!', 'Let\'s go!'],
    ['Tinitivi forti, ca si parti!', 'Hold on tight, we are off!'],
    ['Cinture? Quali cinture? Ahahah.', 'Seatbelts? What seatbelts? Hahaha.'],
  ],
  ask: [
    ['Bona scelta, picciotti! Ci pensu iù.', 'Good choice, kids! Leave it to me.'],
    ['Si mancia bonu, là. Amunì!', 'You eat well there. Let\'s go!'],
  ],
  askMeusa: [
    ['Ca meusa è vita!', 'Spleen sandwich is life!'],
    ['Schietta o maritata? Ma prima arrivamu.', 'Plain or "married" (with cheese)? First we have to get there.'],
  ],
  fast: [
    ['Talìa chi velocità! Sugnu u Schumacher di Bagheria!', 'Look at that speed! I am the Schumacher of Bagheria!'],
    ['Chistu è u Gran Premiu di Mondellu!', 'This is the Mondello Grand Prix! (?)'],
  ],
  drift: [
    ['Mizzica, di traversu comu un pisci!', 'Damn, sideways like a fish!'],
    ['Nta stu vicolu si fa accussì!', 'In this alley this is how it is done! (?)'],
  ],
  wheels: [
    ['Du roti sunnu abbastanza, chi mi servunu tri?', 'Two wheels are enough, why would I need three? (?)'],
    ['Equilibrio sicilianu!', 'Sicilian balance! (?)'],
  ],
  miss: [
    ['Pi un capiddu!', 'By a hair!'],
    ['Talìa unni camina chistu!', 'Look where this one is walking! (?)'],
  ],
  hitPed: [
    ['Ma unni ti metti, nta strata?!', 'Where do you stand, in the street?!'],
    ['Scusa, bedda, nun t\'avia vistu!', 'Sorry, beautiful, I had not seen you!'],
    ['I pedoni a Palermu sunnu comu i semafori: ci sunnu, ma nuddu ci fa casu.', 'Pedestrians in Palermo are like traffic lights: they exist, but nobody pays attention. (?)'],
  ],
  hitWall: [
    ['U muru mi vinni \'ncontru, ju nun c\'entru!', 'The wall came at me, it is not my fault! (?)'],
    ['Chistu è un muru normanno: nun si move.', 'That is a Norman wall: it does not move. (?)'],
  ],
  late: [
    ['Mi dispiaci, u traffico è traffico: accusa u Comune!', 'Sorry, traffic is traffic: blame the Comune!'],
    ['Cu va chianu, va sanu e va luntanu!', 'Who goes slowly goes safely and far!'],
  ],
  arrive: [
    ['Semu arrivati! Bon appetitu, picciotti!', 'We have arrived! Enjoy your meal, kids!'],
    ['Arrivati! Pagati, ca mi scappa u tempu.', 'Arrived! Pay up, I am running out of time.'],
    ['Ca meusa vi aspetta. Vi salutu!', 'The spleen sandwich is waiting for you. Goodbye!'],
  ],
  fail: [
    ['Nun mi dicissi nenti: ju sugnu in orariu... palermitanu!', 'Do not say anything: I am on time... Palermo time!'],
    ['Cu avi pressa, parti prima.', 'Whoever is in a hurry should have left earlier. (?)'],
  ],
  stig: [
    ['Chista è benzina vera!', 'That is real fuel!'],
    ['Stigghiola e nitro: Palermu \'n tavola!', 'Stigghiola and nitro: Palermo on a plate!'],
  ],
  ambient: [
    ['Chi cavuru! Pari ca semu nta u furnu da focacceria.', 'What heat! It feels like we are in the focacceria\'s oven. (?)'],
    ['U parcheggiu? Doppu a Missa. In doppia fila, comu sempri.', 'Parking? After Mass. Double parked, as always. (?)'],
    ['L\'AMAT? Passa quannu voli iddu.', 'The AMAT bus? It comes when it feels like it.'],
    ['Arancina! Arancina, no arancinu! U sapi tuttu u munnu.', 'Arancina, not arancino! The whole world knows that.'],
    ['I sensi unici? Sunnu suggerimenti.', 'One-way streets? They are suggestions.'],
    ['Viva Palermu e Santa Rosalia!', 'Long live Palermo and Santa Rosalia!'],
    ['U russu du semaforu è un colore, nun un ordini.', 'The red of a traffic light is a colour, not an order. (?)'],
    ['Talìa chi bedda jurnata!', 'Look what a beautiful day!'],
  ],
};

// street cries of the stigghiulari
export const VENDOR = [
  ['Stigghiola! Stigghiolaaa!', 'Stigghiola! Stigghiolaaa!'],
  ['Stigghiola caura!', 'Hot stigghiola! (?)'],
  ['Pigghiati a stigghiola, picciotti!', 'Get your stigghiola, kids! (?)'],
  ['Fumu e sapuri!', 'Smoke and flavour! (?)'],
];
export const VENDOR_SERVE = [
  ['Teni, mangia ca è cavuda!', 'Here, eat, it is hot! (?)'],
  ['Pi tia, cu u limuni!', 'For you, with lemon! (?)'],
];

// destinations: where the tourists want to eat. lat/lon from OpenStreetMap (see places.md)
export const DESTS = [
  { id: 'focacceria', name: 'Antica Focacceria San Francesco', addr: 'Via Alessandro Paternostro 58, Kalsa', lat: 38.1163329, lon: 13.3661444, meusa: true,
    food_en: 'panelle, arancine and the spleen sandwich', food_de: 'Panelle, Arancine und das Milzbrötchen', food_fr: 'des panelle, des arancine et le sandwich à la rate' },
  { id: 'nino', name: 'Nino u Ballerino', addr: 'Corso Finocchiaro Aprile 76', lat: 38.1187009, lon: 13.3490904, meusa: true,
    food_en: 'the spleen sandwich', food_de: 'das Milzbrötchen', food_fr: 'le sandwich à la rate' },
  { id: 'kepalle', name: 'Ke Palle', addr: 'Via Maqueda 270', lat: 38.11769, lon: 13.3600809,
    food_en: 'the fancy arancine', food_de: 'die feinen Arancine', food_fr: 'les arancine' },
  { id: 'franco', name: 'Nni Franco u Vastiddaru', addr: 'Piazza Marina 2, Kalsa', lat: 38.1178795, lon: 13.3671013, meusa: true,
    food_en: 'the spleen sandwich', food_de: 'das Milzbrötchen', food_fr: 'le sandwich à la rate' },
  { id: 'ballaro', name: 'Mercato di Ballarò', addr: 'Piazza del Carmine, Albergheria', lat: 38.1113556, lon: 13.3615778,
    food_en: 'street food', food_de: 'Streetfood', food_fr: 'du street food' },
  { id: 'capo', name: 'Mercato del Capo', addr: 'Via Porta Carini', lat: 38.1186189, lon: 13.3540701,
    food_en: 'street food', food_de: 'Streetfood', food_fr: 'du street food' },
  { id: 'vucciria', name: 'Piazza Garraffello (Vucciria)', addr: 'Vucciria', lat: 38.1179401, lon: 13.3649292,
    food_en: 'street food', food_de: 'Streetfood', food_fr: 'du street food' },
  // Suggested by Hubert; OSM/Nominatim: bar at Discesa Maccheronai 9, Vucciria.
  { id: 'taverna', name: 'Taverna Azzurra', addr: 'Discesa Maccheronai 9, Vucciria', lat: 38.1176395, lon: 13.363446,
    food_en: 'a drink at the old tavern', food_de: 'einen Drink in der alten Taverne', food_fr: 'un verre à la vieille taverne' },
];

// where tourists wait (landmarks, the same coordinates as the teleport spots in main.js)
export const PICKUPS = [
  { name: 'Quattro Canti', lat: 38.115684, lon: 13.36146 },
  { name: 'Teatro Massimo', lat: 38.1199, lon: 13.3573 },
  { name: 'Cattedrale', lat: 38.1146, lon: 13.3558 },
  { name: 'Palazzo dei Normanni', lat: 38.1112, lon: 13.354 },
  { name: 'Piazza Pretoria', lat: 38.1151, lon: 13.3622 },
  { name: 'La Cala', lat: 38.1203, lon: 13.3676 },
  { name: 'Stazione Centrale', lat: 38.1092, lon: 13.3655 },
];

// stigghiulari (grill vendors): lat/lon from OpenStreetMap via Nominatim
export const VENDORS = [
  { id: 'carmine', name: 'Piazza del Carmine (Ballarò)', lat: 38.1113425, lon: 13.3618234, skin: 'vendor' },
  { id: 'capo', name: 'Mercato del Capo', lat: 38.1186189, lon: 13.3540701, skin: 'vendor2' },
  { id: 'magione', name: 'Piazza Magione (Kalsa)', lat: 38.1130251, lon: 13.369685, skin: 'coppola2' },
  { id: 'garraffello', name: 'Piazza Garraffello (Vucciria)', lat: 38.1179401, lon: 13.3649292, skin: 'fruttivendolo' },
];

// real places that are outside today's drivable box, for later
export const LATER = [
  { name: 'Piazza della Kalsa', lat: 38.1158659, lon: 13.3735872, note: 'about 40 m outside the box (stigghiola vendor, Kalsa)' },
  { name: 'Antica Friggitoria Chiluzzo, Via Torremuzza', lat: 38.1163042, lon: 13.373051, note: 'just outside the box (panelle, Kalsa)' },
  { name: 'Via Ernesto Basile (stigghiola, Pagliarelli side)', lat: 38.0993011, lon: 13.3468323, note: 'Nominatim node of the road; far south of the box' },
  { name: 'Viale Regione Siciliana (stigghiola, Pagliarelli side)', lat: null, lon: null, note: 'no Nominatim result, coordinates still to find' },
];

// =====================================================================================================================
// NIGHT: everything below only exists after dark (src/missions.js reads game.time via the pedestrians module).
// Palermitan and Italian lines are [text, gloss] pairs; "(?)" in the gloss = the Palermitan is a guess, owner please review.
// =====================================================================================================================

// ---- Easter egg "u spacciaturi": at night, stop for a few seconds in one of these places and a hooded guy walks up.
// There is nothing to buy: you can only drive off. Zones are position-based (Zisa and Noce are outside the centro map,
// they only matter when the whole-city tiles are on). Centres from OpenStreetMap via Nominatim (see places.md).
export const SPACCIA = {
  // the owner's line, keep exactly as written
  hail: ['Ou curò, chi tti siaibbi?', 'Hey buddy, what do you need? (owner\'s spelling, kept as is)'],
  // the driver's dismissive answers
  driver: [
    ['Nenti, nenti: sugnu fermu pi viriri u panorama.', 'Nothing, nothing: I am stopped to admire the view. (?)'],
    ['Curò, ju sugnu lapista, nun sugnu cliente. Annamu.', 'Buddy, I am a lapa driver, not a customer. Let us go. (?)'],
    ['Vossia sbagghiau persona: ju vegnu di missa.', 'You have the wrong person: I am coming from Mass. (?)'],
    ['Grazzi, ma haiu già a me dosi di guai: a patenti.', 'Thanks, but I already have my dose of trouble: my licence. (?)'],
    ['Staiu aspittannu a me cummari. Idda nun sapi ca ci sugnu ju.', 'I am waiting for my girlfriend. She does not know I am here. (?)'],
  ],
};
export const SPACCIA_ZONES = [
  { id: 'ballaro', name: 'Ballarò', lat: 38.1113556, lon: 13.3615778, r: 110 },
  { id: 'vucciria', name: 'Vucciria', lat: 38.1181915, lon: 13.3652235, r: 90 },
  { id: 'capo', name: 'Il Capo', lat: 38.1186189, lon: 13.3540701, r: 100 },
  { id: 'zisa', name: 'Zisa', lat: 38.1167741, lon: 13.3410551, r: 170 },
  { id: 'noce', name: 'Noce', lat: 38.1219451, lon: 13.3329544, r: 170 },
];

// ---- Night mission "A Favorita". Needs the whole-city tiles (?world=1): the Favorita is about 3.9 km north-west of Quattro Canti.
// The client is a mild satire of a respectable man who is somewhere he claims not to be; the glam night folk on the avenue
// are cheerful and in on the joke, and the joke is entirely on him.
export const FAVORITA = {
  // Viale Diana, snapped to the road centreline of the world tiles (Nominatim point 38.1485191, 13.3463992); (dx, dz) = road direction
  dest: { name: 'Viale Diana, Favorita', addr: 'Parco della Favorita', lat: 38.148519, lon: 13.346399, dx: 0.757, dz: -0.653 },
  client: {
    flag: [
      ['Psst! Lapista! Fermati... ma discretamente.', 'Psst! Driver! Stop... but discreetly. (?)'],
      ['Ehi! Tassista! Ccà, ccà. No, nun guardari a mmia.', 'Hey! Taxi! Here, here. No, do not look at me. (?)'],
    ],
    board: [
      ['Bonasira. Sugnu... un ispettori. Di... cosi. Pi lavoru.', 'Good evening. I am... an inspector. Of... things. For work. (?)'],
      ['Chi bedda nuttata. Nuddu mi canusci, vero?', 'What a lovely night. Nobody knows me, right? (?)'],
    ],
    ask: [
      ['Mi porti ai viali da Favorita. Pi... na passiata. Salutari: u medicu m\'ha ordinatu.', 'Take me to the avenues of the Favorita. For... a walk. Healthy: the doctor ordered it. (?)'],
      ['Va ammirari i pini, ccà. Sunnu pini di valuri storicu.', 'I go to admire the pines there. They are of historical value. (?)'],
      ['Na cosa riservata. Me muggheri pensa ca sugnu a na riunioni di condominiu.', 'Something confidential. My wife thinks I am at a condominium meeting. (?)'],
    ],
    ambient: [
      ['Chi malu occhiali, di notti? Pi... a luna. Mi fa mali all\'occhi.', 'Why sunglasses at night? For... the moon. It hurts my eyes. (?)'],
      ['Cchiù chianu! Mi pari ca mi talia tuttu u quartieri.', 'Slower! It feels like the whole neighbourhood is looking at me. (?)'],
      ['Nun mi taliari nta u specchiettu, grazzi.', 'Do not look at me in the mirror, thanks. (?)'],
      ['Si mi ricanuscinu mi rovinu: sugnu... cunsigghieri.', 'If they recognise me I am ruined: I am... a councillor. (?)'],
      ['Chistu è un impermeabili. Perché? Pi... a pioggia.', 'This is a raincoat. Why? For... the rain. (?) (it is not raining)'],
    ],
    fast: [['Mi viniu u giramentu di testa... o è u rimorsu?', 'I feel dizzy... or is it remorse? (?)']],
    drift: [['Mamma mia! Se mi vidi cu a lapa di traversu, mi runi a prima pagina!', 'Mamma mia! If they see me in a sideways lapa I make the front page! (?)']],
    wheels: [['Du roti! Cu u me cori! Chiamati u cunfissuri!', 'Two wheels! With my heart! Call the confessor! (?)']],
    miss: [['Nun m\'ammazzari, ca ancora haiu... tanti pini d\'ammirari!', 'Do not kill me, I still have... so many pines to admire! (?)']],
    hitPed: [['Chi è, un testimoni? Nun m\'ha vistu nuddu, vero?', 'What, a witness? Nobody saw me, right? (?)']],
    hitWall: [['Chi botta! Mi vagnu u... impermeabili.', 'What a bump! I am wetting my... raincoat. (?)']],
    late: [['Prestu, prestu, ca fra picca mi veni u rimorsu! O me muggheri.', 'Hurry, hurry, soon remorse comes! Or my wife. (?)']],
    arrive: [
      ['Ecco, ecco, grazzi. Teni, e nun diri nenti a nuddu!', 'Here, here, thanks. Keep it, and tell nobody! (?)'],
      ['Ti pregu, ti pregu: nun lu diri a nuddu. Ju ccà nun ci sugnu mai statu. Mai.', 'I beg you: tell nobody. I was never here. Never. (?)'],
    ],
    fail: [['Nun fa nenti, m\'addummannu a casa... a pedi... cu a cuscienza.', 'Never mind, I will go home... on foot... with my conscience. (?)']],
    // the answer to the glam folk who greet him by name
    caught: [['Bonasira... nun... nun ci canusciu, signurina.', 'Good evening... I do not... I do not know you, miss. (?)']],
  },
  // the driver, who sees everything and says it with a straight face
  driver: {
    board: [['Salutari, eh? Certu, certu. A Favorita è u postu giustu pi u cori.', 'Healthy, of course. The Favorita is the right place for the heart. (?)']],
    depart: [['Cinturi? Nun serbi: ccà nuddu viri nenti.', 'Seatbelts? No need: nobody sees anything here. (?)']],
    ask: [['Tranquillu, avvucatu: ju sugnu na tomba.', 'Relax, lawyer: I am a tomb. (?)']],
    arrive: [
      ['Sugnu na tomba, avvucatu. Ma u tassametru parla.', 'I am a tomb, lawyer. But the meter talks. (?)'],
      ['Nun c\'è prublema. Ju ccà passu ogni notti: mi ricordu tutti i facci.', 'No problem. I pass here every night: I remember all the faces. (?)'],
    ],
  },
  // the glam night folk greeting him; two of them know him, which is the whole joke
  chorus: [
    ['Buonasira, Cunsigghieri!', 'Good evening, Councillor! (?)'],
    ['Talè, u signuri di sempri!', 'Look, the usual gentleman! (?)'],
    ['Cunsigghieri, e i pini? Li ammirati sempri?', 'Councillor, and the pines? Still admiring them? (?)'],
    ['Cumu va, Avvucatu? E a riunioni di condominiu?', 'How is it going, Lawyer? And the condominium meeting? (?)'],
  ],
};

// ---- Two more night clients, the same system as FAVORITA above (src/event-fares.js uses `client` and `driver` of whichever applies): a man who asks for Via Lincoln and a man who asks for
// Via Bandiera, both winking ("vabbé u sai") and both in a hurry not to be seen. The joke is on the client's embarrassment only: nothing explicit, nobody at the destination is
// described or mocked (the person he goes to see in Via Bandiera is only named, offstage). Palermitan drafts for the owner to correct (docs/palermitan-review.md); the glosses are ours.
export const NIGHT_CLIENTS = {
  lincoln: {
    client: {
      flag: [
        ['Psst! Lapista! Ccà... ma senza fari scena.', 'Psst! Driver! Here... but no fuss.'],
        ['Ehi! Pi favuri, cu discriziuni. Haiu a gghiri ’nta na stratuzza.', 'Hey! Please, discreetly. I have to go to a little street.'],
      ],
      board: [
        ['Bonasira. Sugnu un... tecnicu ri... cosi. Pi lavoru.', 'Good evening. I am a... technician of... things. For work.'],
        ['Mi raccumannu: un parrari, ca mi canusci tuttu u quartieri.', 'Please do not talk, the whole neighbourhood knows me.'],
      ],
      ask: [
        ['Via Lincoln. Vabbé, u sai... pi na cosa.', 'Via Lincoln. Well, you know... for a thing.'],
        ['Mi porti a via Lincoln. Haiu a... cuntrullari na cosa ri famigghia.', 'Take me to Via Lincoln. I have to... check a family matter.'],
        ['Via Lincoln, e un ti scurdari: ccà un ci sugnu mai statu.', 'Via Lincoln, and do not forget: I have never been there.'],
      ],
      ambient: [
        ['Chi viernu ca fa... mi mettu u cappeddu ’nta facci.', 'What a winter... I pull my hat over my face.'],
        ['Cchiù chianu, ca mi talianu tutti.', 'Slower, everyone is looking at me.'],
        ['Un taliari ’nta u specchiettu, pi favuri.', 'Do not look in the mirror, please.'],
        ['Sugnu... in missioni pi cuntu ra parrocchia.', 'I am on a mission for the parish.'],
      ],
      fast: [['Mamma mia, mi scappa u cappeddu! E a cuscienza!', 'Mamma mia, my hat is flying off! And my conscience!']],
      drift: [['Ohi! Si mi viri u parrinu accussì, mi scumunica!', 'Ohi! If the priest sees me like this he excommunicates me!']],
      wheels: [['Du roti! Chiamati a me muggheri... no, lassati stari!', 'Two wheels! Call my wife... no, leave it!']],
      miss: [['Chianu! Haiu ancora tanti cosi ri fari!', 'Easy! I still have so many things to do!']],
      hitPed: [['Ma cu è? Un lu canusciu, ci l’aiuru!', 'Who is that? I do not know him, I swear it!']],
      hitWall: [['Chi botta! Mi cariu u cappeddu!', 'What a bump! My hat fell off!']],
      late: [['Curri, ca si fa tardu e mi viri a luna!', 'Hurry, it is getting late and the moon sees me!']],
      arrive: [
        ['Ecco, ecco. Teni, e... vabbé u sai: nuddu sapi nenti.', 'Here, here. Keep it, and... well, you know: nobody knows anything.'],
        ['Grazzi, amicu. Tu un m’ha vistu. Mai.', 'Thanks, friend. You did not see me. Never.'],
      ],
      fail: [['Nun fa nenti, ci vaiu a pedi... cu u cappeddu ’n testa.', 'Never mind, I will go on foot... with my hat on.']],
    },
    driver: {
      board: [['Tranquillu, cumpari. Via Lincoln, certu. Pi... a cosa.', 'Relax, pal. Via Lincoln, of course. For... the thing.']],
      depart: [['Annamu, annamu, ca a nuttata è longa.', 'Let us go, let us go, the night is long.']],
      ask: [['A mia nuddu m’ha ittu nenti.', 'Nobody told me anything.']],
      arrive: [['Bonanuttata, cumpari. Ma u tassametru parla.', 'Good night, pal. But the meter talks.']],
    },
  },
  bandiera: {
    client: {
      flag: [
        ['Psst, lapista! Accustati, ma cu garbu.', 'Psst, driver! Pull over, but gently.'],
        ['Ehi! Ccà! Haiu a gghiri... vabbé u sai unni.', 'Hey! Here! I have to go... well, you know where.'],
      ],
      board: [
        ['Bonasira. Mi porti a via Bandiera? Nni Nicoletta a Trimmutura, vabbé u sai.', 'Good evening. Take me to Via Bandiera? To Nicoletta a Trimmutura’s, well, you know.'],
        ['Un parrari assai, eh? Nicoletta mi spetta, vabbé u sai.', 'Do not talk much, eh? Nicoletta is expecting me, well, you know.'],
      ],
      ask: [
        ['Via Bandiera, nni Nicoletta a Trimmutura. Vabbé u sai, no? Ci haiu a purtari i cannola.', 'Via Bandiera, to Nicoletta a Trimmutura’s. Well, you know, right? I have to bring her the cannoli.'],
        ['Nni Nicoletta a Trimmutura, via Bandiera. Chi dici? Ca è n’autru seculu? Ma chi dici, mi spetta! Vabbé u sai.', 'To Nicoletta a Trimmutura’s, Via Bandiera. What do you say? That it is another century? Come on, she is expecting me! Well, you know.'],
        ['Nun ti dugnu autri spiegazioni, vabbé u sai.', 'I will give you no more explanations, well, you know.'],
      ],
      ambient: [
        ['Mi raccumannu: cu me muggheri nenti. Vabbé u sai.', 'Not a word to my wife. Well, you know.'],
        ['Nni Nicoletta ci vaiu pi... affari. Riceve ancora, eh, ju u sacciu.', 'I go to Nicoletta’s for... business. She is still receiving, eh, I know it.'],
        ['Chi calurusa sta nuttata, eh? Mi senti u cori...', 'Quite a warm night, eh? My heart...'],
        ['Talìa ca mi canuscinu: mi mettu u giurnali ’nta facci.', 'Look, they know me: I put the newspaper over my face.'],
      ],
      fast: [['Cchiù chianu, ca mi veni u mal ri mari!', 'Slower, I am getting seasick!']],
      drift: [['Maronna! Si u sapi me suoru mi scumunica ’ntô luocu!', 'Madonna! If my sister finds out she excommunicates me on the spot!']],
      wheels: [['Du roti! U me cori un regi!', 'Two wheels! My heart cannot take it!']],
      miss: [['Chianu! Nicoletta mi spetta, vabbé u sai!', 'Easy! Nicoletta is waiting for me, well, you know!']],
      hitPed: [['Un fu cuorpa mia! Un m’ha vistu nuddu!', 'It was not my fault! Nobody saw me!']],
      hitWall: [['Ahia! Mi cariru i cannola!', 'Ouch! The cannoli fell!']],
      late: [['Prestu, ca i cannola s’ammuscianu!', 'Hurry, the cannoli are going soft!']],
      arrive: [
        ['Ecco, ecco: grazzi. Teni, e vabbé u sai: muto.', 'Here, here: thanks. Keep it, and well, you know: mum.'],
        ['Mi raccumannu: nuddu sapi nenti. Salutami... vabbé u sai.', 'Please: nobody knows anything. Say hello for me to... well, you know.'],
      ],
      fail: [['Nun fa nenti, ci vaiu a pedi... cu i cannola ’n manu.', 'Never mind, I will go on foot... with the cannoli in my hand.']],
    },
    driver: {
      board: [['Via Bandiera, vabbé u sai. Ju sugnu cieco e surdu.', 'Via Bandiera, well, you know. I am blind and deaf.'], ['Nni Nicoletta a Trimmutura? Cumpari, chidda un c’è cchiù ri na vita.', 'To Nicoletta a Trimmutura’s? Pal, she has been gone for a lifetime.']],
      depart: [['Chianu chianu, ca i cannola un si spezzanu.', 'Gently, gently, so the cannoli do not break.']],
      ask: [['Nenti ri nenti, cumpari. Mutu.', 'Nothing about nothing, pal. Mum.']],
      arrive: [['Ci semu, cumpari. Salutami... nuddu. Ma u tassametru parla.', 'We are here, pal. Say hello to... nobody. But the meter talks.']],
    },
  },
};

// ---- The horns mission (src/event-horns.js, docs/horns.md): the citizen in Piazza Pretoria hands the lapa a huge pair of horns, and the lapa takes them under the Arco di Cutò. It rests on the real
// Palermo saying that nobody passes under the arch of Cutò without scratching their head (the horns). The saying is general and points at nobody; so do all the lines. Palermitan drafts.
export const HORNS_LINES = {
  // both blanks stay bleeped, on screen and in sound: the balloons from the street while the horns are on
  bip: [['Dottò BIP, lei è un BIP!', 'Doctor BEEP, you are a BEEP!']],
  notme: [["Un u rissi iu, u rissi n'autru.", 'It was not me who said it, it was someone else.']],
  call: [
    ['Psst! Lapista! Vinni ccà, ca t’haiu a dari na cosa!', 'Psst! Driver! Come here, I have something to give you!'],
    ['Amunì, ca è na missioni ri paisi: i cuorna!', 'Come on, it is a town mission: the horns!'],
  ],
  give: [
    ['Teni ’sti cuorna, mettitilli ’ncapu e vai ô Cutò.', 'Take these horns, put them on and go to the Cutò.'],
    ['Sutta l’arcu ri Cutò nuddu passa senza grattarisi a testa!', 'Nobody passes under the arch of Cutò without scratching their head!'],
  ],
  go: [
    ['Camina, camina, ca l’arcu è ddà ’nfunnu.', 'Keep going, the arch is down there.'],
    ['Attentu ca sunnu larghi, eh!', 'Careful, they are wide, eh!'],
  ],
  scrape: [
    ['Craaaac! Un ci passanu!', 'Craaack! They will not fit!'],
    ['Aaaahia! Sunnu truappu larghi!', 'Aaaahia! They are far too wide!'],
  ],
  head: [
    ['Gràttiti a testa, ca ci stai passannu!', 'Scratch your head, you are going through!'],
    ['Visti? Sutta l’arcu ri Cutò un si passa senza grattarisi a testa!', 'See? Under the arch of Cutò nobody passes without scratching their head!'],
  ],
  careful: [['Ma chi fai, ci addummanni u permissu?', 'What are you doing, asking permission?']],
  careless: [['Chianu, un c’è premura! I cuorna!', 'Easy, no hurry! The horns!']],
  passers: [
    ['Ahahah! Talìa chi cuorna!', 'Hahaha! Look at those horns!'],
    ['Gràttiti a testa, ca ti pizzica!', 'Scratch your head, it itches!'],
    ['Ahahah! Bravu!', 'Hahaha! Well done!'],
  ],
  fail: [['Vabbè, i cuorna mi li pigghiu iu.', 'Fine, I will take the horns back myself.']],
};

// ---- "Pollanche": vendors roasting corn cobs on charcoal at the Santuario di Santa Rosalia (Monte Pellegrino).
// Position-based, only built when the lapa gets near (whole-city tiles). Santuario from Nominatim (38.1680111, 13.351843); the carts stand
// beside the service road, snapped to the world tiles: (rx, rz) points from the cart to the road.
export const POLLANCHE = {
  cry: [
    ['POLLANCHEEEE!', 'CORN ON THE COB! (the real street cry)'],
    ['POLLANCHEEEE CAURE!', 'HOT CORN ON THE COB! (?)'],
    ['Pollanche! Pollanche arrustuti!', 'Corn! Roasted corn! (?)'],
  ],
  serve: [
    ['Teni, cu u sali e u limuni!', 'Here, with salt and lemon! (?)'],
    ['Pi tia, ca è cavuda!', 'For you, it is hot! (?)'],
  ],
  sites: [
    { id: 'santuario', name: 'Santuario di Santa Rosalia (Monte Pellegrino)', lat: 38.16809, lon: 13.351714, rx: -0.793, rz: -0.610, skin: 'coppola2' },
    { id: 'tornante', name: 'Via Santuario, Monte Pellegrino', lat: 38.166878, lon: 13.349531, rx: 1.0, rz: -0.016, skin: 'nonno_gilet' },
  ],
};

// ---- "Appartati": parked cars with steamed-up windows at Monte Pellegrino's lookouts and in quiet corners of the Favorita.
// Strictly innuendo: a fogged car gently rocking, nobody visible. Flash the headlights or honk and the rocking stops,
// the windows flash and a balloon yells. Lookouts from OpenStreetMap (tourism=viewpoint, amenity=parking), each snapped to the nearest
// road of the world tiles and set on the verge: (dx, dz) = the road direction, the car is parked along it.
export const APPARTATI = {
  yell: [
    ['Ma chi fari sunnu chisti?! Astuta, screanzatu!', 'What headlights are these?! Turn them off, rude one! (?)'],
    ['Ma ti pari u modu?! Chista è na maccina privata!', 'Is that any way to behave?! This is a private car! (?)'],
    ['Eh! Stavamu... cuntannu i stiddi!', 'Hey! We were... counting the stars! (?)'],
    ['Stavamu sulu... ripassannu u codici stradali!', 'We were only... revising the highway code! (?)'],
    ['Talè chi maleducatu! Cca c\'è genti ca parla!', 'Look at this rude guy! People are talking here! (?)'],
  ],
  sites: [
    { id: 'palermoview', name: 'Palermo view (Via Pietro Bonanno)', lat: 38.152503, lon: 13.361140, dx: -0.756, dz: -0.655, col: '#8a2f3a' },
    { id: 'upper', name: 'Via Padre Giordano Cascini', lat: 38.175436, lon: 13.361309, dx: 0.039, dz: 0.999, col: '#2f4a6b' },
    { id: 'tornante', name: 'Via Santuario, Monte Pellegrino', lat: 38.166878, lon: 13.349531, dx: 0.016, dz: 1.0, col: '#6b6f78' },
    { id: 'fante', name: 'Viale del Fante (Favorita)', lat: 38.150316, lon: 13.342227, dx: -0.405, dz: -0.914, col: '#3f6b4a' },
    { id: 'bosco', name: 'Strada di servizio (Favorita)', lat: 38.151318, lon: 13.339685, dx: -0.887, dz: 0.461, col: '#c9c4b8' },
    { id: 'matrimoni', name: 'Piazzale dei Matrimoni (Viale Ercole)', lat: 38.151393, lon: 13.347968, dx: 0.506, dz: 0.863, col: '#b8862a' },
  ],
};

// ---------------------------------------------------------------------------------------------------------------------------------
// Free roam events (src/missions.js, src/event-*.js, src/races.js). Lines are [text, gloss] pairs or plain strings; {items} is the lost food.
// What the people on the kerb shout to call the lapa.
export const CALL = {
  tourist: [['Taxi! Taxi! Over here!', ''], ['Hello! Excuse me! Are you free?', ''], ['Hey! Driver! Please, please!', ''], ['Is that a taxi? Please be a taxi!', '']],
  taxi: [['Taxi! Ao, taxi!', ''], ['Fermati, fermati!', 'Stop, stop!'], ['Lapista! Mi puoiti?', 'Driver! Can you take me?'], ['Ehi! Libiru?!', 'Hey! Free?!']],
  // hotel-concierge tourists, by day: they have been told to ask for "a pulle" and have no idea what it is
  pulle: [['Excuse me! Do you know "a pulle"? The hotel man winked a lot.', ''], ['Hello! We need "a pulle". Is it far? Is it a restaurant?', ''], ['Taxi! "A pulle", please! Everybody says it with a smile!', '']],
  food: [['Aiutooo! Mi sunnu scappati i {items}!', 'Heeelp! My {items} ran away!'], ['Fermati! I {items} sunnu vulati via!', 'Stop! The {items} flew off!'], ['Ao! Aiutami! Haiu pirdutu i {items}!', 'Hey! Help me! I lost the {items}!']],
  // the two rave missions (src/event-rave.js): the sound man at the centro sociale ExKarcere, and the friend at the rave. Palermitan, written by an agent: for the owner to correct.
  rave: [['Ou! Amunì, ca i casse pû rave su ccà! Puitali ’n cima ô Pellegrinu, ma araciu, ca sunnu dilicati!', 'Hey! Come on, the speakers for the rave are here! Take them up on Pellegrino, but nice and slow, they are delicate!'], ['Talè, lapista, ci mittiemu i casse ’nta lapa e tu ti ni vai ô rave. Ti raccumannu, un li rumpiri!', 'Look, driver, we put the speakers on the lapa and you take them to the rave. Please, do not break them!'], ['Sienza casse u rave un paiti! Pigghia sta ruobba e curri, ma cu giudiziu!', 'No speakers, no rave! Take this stuff and run, but carefully!']],
  leaf: [["Psst cucì, a'gghiri nni Cipressi p'accattari... vabbé u sai, runami un passaggio amunì", 'Psst cousin, I have to go to Cipressi to buy... well, you know, give me a lift, come on'], ['Nni mancunu ’nu para ri fuogghi allegri pâ serata. Va’ a via Cipressi e talìa ’ntô giru. Suarridi e un dari ’ntall’occhiu.', 'We are short of a couple of happy leaves for the night. Go to via Cipressi and look around. Smile and do not draw attention.']],
  race: [['Cu vinci, paga! Amunì!', 'Winner buys! Let\'s go!'], ['Fermati ccà e cuorri cu nuatri!', 'Stop here and race with us!'], ['Tri, dui, unu... cuasi!', 'Three, two, one... almost!']],
};
// Two pals of the lapista (the cameo friends of the cast, ids amico1_* and amico2_*) who sometimes wave the lapa down for a ride. Same shape as the other
// passenger lines: [Italian or Sicilian, English]. They never use a name and say nothing about how anybody looks.
export const FRIEND = {
  amico1: {
    hail: [['Lapista! Fermati! Ti offru ’na stigghiola... a metà.', 'Driver! Stop! I will buy you a stigghiola... half of one.'], ['Ehi, amunì! Mi runi ’nu passaggiu? Pagu doppu!', 'Hey, come on! A lift? I pay later!'], ['Talìa chi cuincidienza! Libiru?', 'Look at that, what luck! Free?'], ['Fratì! Mi puoiti? Haiu lassatu u motorinu a casa!', 'Brother! Can you take me? I left the scooter at home!']],
    board: [['Biedda matri, ’sta cosa va ’ntô seriu!', 'Holy mother, this thing is for real!'], ['Paiti puru, iu mi riggu ô tettu.', 'Go ahead, I will hold on to the roof.']],
    ambient: [['Sai ca ccà l’aria è sempri buona? Doppu i tri.', 'You know the air here is always nice? After three o’clock.'], ['Iu u dicu sempri: a tangenziali è n’opinioni.', 'I always say it: the ring road is an opinion.'], ['Si viri ’nu bar apiertu, fai finta ri nienti.', 'If you see an open bar, pretend you did not.']],
    drift: [['Minchia! Arrè, arrè!', 'Wow! Again, again!']], wheels: [['Supra dui ruoti! M’è passata a sunnulenza!', 'On two wheels! My sleepiness is gone!']],
    fast: [['Va’, va’! Fai finta ca è ’u Giro!', 'Go, go! Pretend it is the Giro!']], miss: [['Pi ’nu capiddu! Ti haiu a dari ’na granita.', 'By a hair! I owe you a granita.']],
    hitWall: [['Era u muru ca spuntau, eh!', 'The wall came out of nowhere, right!']], hitPed: [['Scusati! Scusati a tutti! Siemu ri fretta!', 'Sorry! Sorry everyone! We are in a hurry!']],
    late: [['Facemu ’na cosa: arrivamu.', 'Let us do this: we arrive.']], arrive: [['Perfettu! Ti pagu... a prossima vota. Scherzu, teni!', 'Perfect! I will pay you... next time. Kidding, here!']], fail: [['Vabbè, c’è sempri rumani.', 'Oh well, there is always tomorrow.']],
  },
  amico2: {
    hail: [['Ehi! Lapista! Puozzu acchianari? Haiu i gammi lunghi, ma m’adattu.', 'Hey! Driver! Can I get in? My legs are long, but I will manage.'], ['Fermati ’n attimu! Ti cuntu ’na cosa mentri annamu.', 'Stop a moment! I will tell you something on the way.'], ['Amunì, amunì! Mi runi ’nu strappu?', 'Come on! Can I have a ride?'], ['Scusa, si libiru? Giuru ca un arrobbu u postu a nuddu.', 'Sorry, are you free? I swear I will not take anyone’s seat.']],
    board: [['’Nu pocu strittu, ma havi u so fascinu.', 'A bit tight, but it has its charm.'], ['Va’ tranquillu. Iu mi chiegu ’n dui.', 'Take it easy. I will fold in half.']],
    ambient: [['U sai ca a Palermu u semaforu è ’nu cunsigghiu?', 'You know that in Palermo the traffic light is a suggestion?'], ['Vitti ’nu gattu cu ’na Vespa, ajeri. Giuru.', 'I saw a cat on a Vespa yesterday. I swear.'], ['Ccà ogni strata havi u so ciauru: panelle o scappamentu.', 'Every street here has its smell: panelle or exhaust.']],
    drift: [['Ahahah! Chista a cuntu!', 'Hahaha! I am telling this one!']], wheels: [['Dui ruoti! Pari ri vulari!', 'Two wheels! It feels like flying!']],
    fast: [['Va’! Sugnu già ’n ritardu ’n anticipu!', 'Go! I am already early for being late!']], miss: [['Ma u vidisti?! Era a ’nu ditu!', 'Did you see that?! It was a finger away!']],
    hitWall: [['Tuttu a postu! U muru si spustau.', 'All good! The wall moved.']], hitPed: [['Oh! Mi dispiaci! Bona iurnata!', 'Oh! Sorry! Have a good day!']],
    late: [['Ci la facemu, ci la facemu... fuorsi.', 'We will make it, we will make it... maybe.']], arrive: [['Grazie mille! Offru iu u cafè. Doppu.', 'Thanks a lot! My treat for the coffee. Later.']], fail: [['Pacienza, ci vaiu a peri. Lungu comu sugnu...', 'Never mind, I will walk. Tall as I am...']],
  },
};
// "A pulle" by day: the tourists in the back seat. By night the client is the discreet one of FAVORITA (above).
export const PULLE = {
  ask: [
    ['Please take us to "a pulle". The man at the hotel winked at us. Twice.', ''],
    ['Is "a pulle" nice? He said it is very popular with the locals. After dark. And before dark.', ''],
    ['Viale Diana, please! He said it is a lovely walk among the pines. He was laughing a lot.', ''],
  ],
  driver: [
    ['Ah! "A pulle"! Certu, certu... mi dispiaci ma ju sugnu na tomba.', 'Ah! "A pulle"! Of course, of course... sorry, I am a tomb. (?)'],
    ['Viale Diana? Bona scelta pi vidiri i pini. Gli alberi, picciotti, solu gli alberi.', 'Viale Diana? Good choice to see the pines. The trees, kids, only the trees. (?)'],
  ],
  arrive: [
    ['Oh! It is... very busy. And everybody is waving at us. Is it a festival?', ''],
    ['Everyone here is so friendly! Why are they all looking at the councillor?', ''],
  ],
  fail: [['We will walk. Is it far? We will ask that nice lady in the sparkly dress.', '']],
};
// Urgent passengers, once they are on board
export const URGENT_LINES = {
  board: [['Vai vai vai! Non fermarti ai semafori!', 'Go go go! Do not stop at the lights!'], ['Presto! Ho i minuti contati!', 'Quick! I have minutes to spare, no more!']],
  driver: [['Tranquillo, ci penso io. Tenetevi forte!', 'Relax, I will handle it. Hold on tight!'], ['Il tassametro è già in quarta!', 'The meter is already in fourth gear!']],
  late: [['Ci siamo quasi?! Il tempo sta finendo!', 'Are we nearly there?! Time is running out!']],
  arrive: [['Ce l\'ho fatta! Tieni, tieni tutto!', 'I made it! Here, keep it all!']],
  fail: [['No, no, no... l\'ho perso!', 'No, no, no... I missed it!']],
};
// The owner when the lost food is brought back
export const FOOD = {
  thanks: [['Grazie, grazie! Si ’n’angilu cu tri ruoti!', 'Thank you, thank you! You are an angel with three wheels!'], ['M’ha saivatu a iurnata! Ti offru quarchi cosa!', 'You saved my day! Let me treat you!']],
  none: [['Nienti?! Pacienza... tuoina quannu hai cchiù furtuna.', 'Nothing?! Never mind... come back when you are luckier.']],
};

// The rave missions: toasts, results and what people say. Palermitan, written by an agent (for the owner to correct); [Sicilian, English].
export const RAVE_LINES = {
  thanks: [['Bravu! Uora sì ca s’abballa!', 'Well done! Now we dance!'], ['Casse sani sani! Si u miegghiu lapista ra città!', 'Speakers safe and sound! You are the best driver in the city!']],
  broken: [['Chi sfaciddu! I casse sunnu rutte... u rave finisci prima ri accuminciari.', 'What a mess! The speakers are broken... the rave is over before it starts.']],
  late: [['Taiddu assai! A genti si ni iu a casa.', 'Far too late! The people have gone home.']],
  hit: [['Crac! Attientu a li casse!', 'Crack! Mind the speakers!'], ['Ahia! Sunnu dilicati, ti l’haiu dittu!', 'Ouch! They are delicate, I told you!']],
  leafThanks: [['Ahhh, chi biedda ciauru r’allegria! Grazie, amicu.', 'Ahhh, what a lovely smell of cheer! Thanks, friend.']],
  leafNone: [['Nienti?! Pacienza, ci piensamu nuatri.', 'Nothing?! Never mind, we will see to it ourselves.']],
  // the friend riding along in the lapa on "Fuogghi allegri" (src/event-rave.js); Palermitan drafts for the owner to correct
  friend: {
    board: [['Amunì, amunì, ca è tardu!', 'Come on, come on, it is late!'], ['Paiti, paiti, ca ni stannu aspittannu!', 'Go, go, they are waiting for us!']],
    ambient: [['Chi biedda sirata, eh?', 'Nice night, eh?'], ['A lapa curri buona, eh!', 'The lapa runs well, eh!'], ['Ci semu cuasi?', 'Are we nearly there?']],
    hitWall: [['Ohi! Ma unni talii?!', 'Ow! Where are you looking?!'], ['Chianu, chianu, ca mi rumpi i uossa!', 'Easy, you will break my bones!']],
    hitPed: [['Ma chi fai, i pirsuni un si tuccanu!', 'What are you doing, you do not touch people!']],
    crash: [['Maronna! Mi stava cariennu ri ’nterra!', 'Madonna! I nearly fell out!'], ['Un c’è bisuognu ri ammazzarini, eh!', 'No need to get us killed, eh!']],
    fast: [['Curri, curri! Ma un ni ammazzari!', 'Go, go! But do not get us killed!']],
    leaf: [['Chista è buona!', 'This one is good!'], ['N’autra, n’autra! Talìa ddà!', 'Another one! Look there!']],
    arrive: [['Ccà semu. Talìa ’ntô giru, ma senza fari scena.', 'Here we are. Look around, but no fuss.']],
    hand: [['Ecculu, u me cumpari! Fermati ccà.', 'There is my pal! Stop here.']],
    off: [['Uora sì ca s’abballa! Ni viremu ô rave!', 'Now we dance! See you at the rave!']],
    fail: [['Basta, scinnu! A pieri fazzu cchiù prestu.', 'Enough, I am getting out! Walking is quicker.']],
  },
};
