// Tips on the loading screen. A classic script with no imports, deferred from index.html: it runs on its own as soon as the page is parsed, before the game's
// bundle (and the data it waits for) has arrived, so the tips are there for the whole of a slow download. One tip at a time, every few seconds, in the language of
// the Options (the saved setting, or ?lang=): that language large, the other one under it, as everywhere in the game. It reads nothing but localStorage, fetches
// nothing, and stops by itself when main.js takes #loading away. The build copies it, minified, to js/ (tools/build/build.mjs); the CSP allows it ('self').
// Every tip says something the game really does (checked against the code); the first one is always about the two upgrades of the Garage.
(function () {
  'use strict';
  var TIPS = [   // [Palermitan, English]
    ['Ô Garage ti poi accattari i galleggianti: cu chiddi guidi supra u mari.', 'You can buy floats in the Garage: with them you drive on the sea.'],
    ['Ô Garage c’è macari i ali: tieni F (o VOLA) pi acchianari e vuli supra a città.', 'The Garage also sells wings: hold F (or VOLA) to climb and fly over the city.'],
    ['Puoita i turisti e guadagni euro: ô Garage ti accatti mezzi nuovi e pezzi.', 'Drive tourists and earn euros: spend them on new vehicles and parts in the Garage.'],
    ['Ô Garage poi cangiari culuri, cerchi, alettuni, neon e macari u clacson.', 'In the Garage you can change colours, rims, spoilers, neon and even the horn.'],
    ['A radio: M cancia a canzuna, N a stuta.', 'The radio: M plays the next track, N turns it on or off.'],
    ['Nta Opzioni poi cangiari a qualità, u volumi, a lingua e puru l’ura ro iornu.', 'In Options you can change the quality, the volume, the language and even the time of day.'],
    ['Di notti i pub su aperti: fermati â puoita e premi B pi viviri.', 'At night the pubs are open: stop at the door and press B to have a drink.'],
    ['Ô stadiu Barbera c’è un palluni: spingilu cû lapa e fai gol.', 'At the Barbera stadium there is a ball: push it with the lapa and score.'],
    ['Reti, muretti e siepi ri giardinu si ruimpinu si ci vai forti.', 'Fences, garden walls and hedges break if you hit them hard enough.'],
    ['Palermu ha tanti segreti: nta Collezioni sunnu ??? finu a quannu un li trovi.', 'Palermo has plenty of secrets: they show as ??? in Collections until you find them.'],
    ['Shift è u nitro: si ricarica cû curriri e cu i sbandati.', 'Shift is the nitro: it refills as you go fast and as you drift.'],
    ['Si ti ’ncastri, premi R: ti rimetti ’nta strata.', 'If you get stuck, press R: it puts you back on the road.'],
    ['Si fai truappu burdellu arriva a pulizzia: fermati e ti fannu a multa.', 'Cause too much chaos and the police come: stop and they fine you.'],
    ['Ni trovi supra Instagram: @bonnie_studios_.', 'Find us on Instagram: @bonnie_studios_.'],
  ];
  var EVERY = 4500, FADE = 320;
  try {
    var box = document.getElementById('loading'), el = document.getElementById('tip');
    if (!box || !el) return;
    var lang = 'it', m = /[?&]lang=(it|en)(&|$)/.exec(location.search);
    try { var saved = JSON.parse(localStorage.getItem('palermoDrive.settings.v1') || 'null'); if (saved && (saved.lang === 'it' || saved.lang === 'en')) lang = saved.lang; } catch (e) { /* storage unavailable: Italian */ }
    if (m) lang = m[1];
    var big = lang === 'en' ? 1 : 0;
    // the order: one of the two upgrade tips first, then the others shuffled
    var first = Math.random() < 0.5 ? 0 : 1, rest = [], i, j, t;
    for (i = 2; i < TIPS.length; i++) rest.push(i);
    for (i = rest.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
    var order = [first].concat(rest, [1 - first]), at = 0;
    var kicker = document.createElement('span'), l1 = document.createElement('span'), l2 = document.createElement('span');
    kicker.className = 'tip-k'; l1.className = 'tip-1'; l2.className = 'tip-2';
    kicker.textContent = lang === 'en' ? 'Tip' : 'Cunsigghiu';
    el.appendChild(kicker); el.appendChild(l1); el.appendChild(l2);
    var show = function () {
      var tip = TIPS[order[at]]; at = (at + 1) % order.length;
      l1.textContent = tip[big]; l2.textContent = tip[1 - big];
      l1.lang = big ? 'en' : 'it'; l2.lang = big ? 'it' : 'en';
    };
    show(); el.className = 'on';
    var timer = setInterval(function () {
      if (!document.getElementById('loading') || box.classList.contains('out')) { clearInterval(timer); return; }
      el.className = '';
      setTimeout(function () { show(); el.className = 'on'; }, FADE);
    }, EVERY);
  } catch (e) { /* the tips are a nicety: never let them break loading */ }
}());
