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
    ['Bedda matri, quanti siti! Stringitivi, ca semu supra a lapa!', 'Holy Mother, how many of you! Squeeze in, this is a lapa!'],
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
    ['Chistu è u Gran Premiu di Mondellu!', 'This is the Mondello Grand Prix!'],
  ],
  drift: [
    ['Mizzica, di traversu comu un pisci!', 'Damn, sideways like a fish!'],
    ['Nta stu vicolu si fa accussì!', 'In this alley this is how it is done!'],
  ],
  wheels: [
    ['Du roti sunnu abbastanza, chi mi servunu tri?', 'Two wheels are enough, why would I need three?'],
    ['Equilibrio sicilianu!', 'Sicilian balance!'],
  ],
  miss: [
    ['Pi un capiddu!', 'By a hair!'],
    ['Talìa unni camina chistu!', 'Look where this one is walking!'],
  ],
  hitPed: [
    ['Ma unni ti metti, nta strata?!', 'Where do you stand, in the street?!'],
    ['Scusa, bedda, nun t\'avia vistu!', 'Sorry, beautiful, I had not seen you!'],
    ['I pedoni a Palermu sunnu comu i semafori: ci sunnu, ma nuddu ci fa casu.', 'Pedestrians in Palermo are like traffic lights: they exist, but nobody pays attention.'],
  ],
  hitWall: [
    ['U muru mi vinni \'ncontru, ju nun c\'entru!', 'The wall came at me, it is not my fault!'],
    ['Chistu è un muru normanno: nun si move.', 'That is a Norman wall: it does not move.'],
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
    ['Cu avi pressa, parti prima.', 'Whoever is in a hurry should have left earlier.'],
  ],
  stig: [
    ['Chista è benzina vera!', 'That is real fuel!'],
    ['Stigghiola e nitro: Palermu \'n tavola!', 'Stigghiola and nitro: Palermo on a plate!'],
  ],
  ambient: [
    ['Chi cavuru! Pari ca semu nta u furnu da focacceria.', 'What heat! It feels like we are in the focacceria\'s oven.'],
    ['U parcheggiu? Doppu a Missa. In doppia fila, comu sempri.', 'Parking? After Mass. Double parked, as always.'],
    ['L\'AMAT? Passa quannu voli iddu.', 'The AMAT bus? It comes when it feels like it.'],
    ['Arancina! Arancina, no arancinu! U sapi tuttu u munnu.', 'Arancina, not arancino! The whole world knows that.'],
    ['I sensi unici? Sunnu suggerimenti.', 'One-way streets? They are suggestions.'],
    ['Viva Palermu e Santa Rosalia!', 'Long live Palermo and Santa Rosalia!'],
    ['U russu du semaforu è un colore, nun un ordini.', 'The red of a traffic light is a colour, not an order.'],
    ['Talìa chi bedda jurnata!', 'Look what a beautiful day!'],
  ],
};

// street cries of the stigghiulari
export const VENDOR = [
  ['Stigghiola! Stigghiolaaa!', 'Stigghiola! Stigghiolaaa!'],
  ['Stigghiola caura!', 'Hot stigghiola!'],
  ['Pigghiati a stigghiola, picciotti!', 'Get your stigghiola, kids!'],
  ['Fumu e sapuri!', 'Smoke and flavour!'],
];
export const VENDOR_SERVE = [
  ['Teni, mangia ca è cavuda!', 'Here, eat, it is hot!'],
  ['Pi tia, cu u limuni!', 'For you, with lemon!'],
];

// destinations: where the tourists want to eat. lat/lon from OpenStreetMap (see places.md)
export const DESTS = [
  { id: 'focacceria', name: 'Antica Focacceria San Francesco', addr: 'Via Alessandro Paternostro 58, Kalsa', lat: 38.1163329, lon: 13.3661444, meusa: true,
    food_en: 'panelle, arancine and the spleen sandwich', food_de: 'Panelle, Arancine und das Milzbrötchen', food_fr: 'des panelle, des arancine et le sandwich à la rate' },
  { id: 'nino', name: 'Nino u Ballerino', addr: 'Corso Calatafimi, Porta Nuova', lat: 38.1115964, lon: 13.3517307, meusa: true,
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
  { name: 'Nino \'u Ballerino, Corso Finocchiaro Aprile 76', lat: 38.1187009, lon: 13.3490904, note: 'about 80 m outside the box' },
  { name: 'Piazza della Kalsa', lat: 38.1158659, lon: 13.3735872, note: 'about 40 m outside the box (stigghiola vendor, Kalsa)' },
  { name: 'Antica Friggitoria Chiluzzo, Via Torremuzza', lat: 38.1163042, lon: 13.373051, note: 'just outside the box (panelle, Kalsa)' },
  { name: 'Via Ernesto Basile (stigghiola, Pagliarelli side)', lat: 38.0993011, lon: 13.3468323, note: 'Nominatim node of the road; far south of the box' },
  { name: 'Viale Regione Siciliana (stigghiola, Pagliarelli side)', lat: null, lon: null, note: 'no Nominatim result, coordinates still to find' },
];
