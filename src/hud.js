// The HUD's places: one for each kind of message, so that two kinds can't land on each other. The zones are in index.html, their CSS in src/ui.css;
// a zone is a flex column, so what stands in it pushes the rest along and nothing positions itself. Every module asks for its zone here.
//   (the row of the menu button and the radio is top left, src/ui.js and src/radio.js: both also exist on the menus, so they stay out of #hud)
//   status   left, under that row: the wanted line (src/police.js), the coordinates (src/coords.js)
//   obj      top centre: the mission card (src/event-hud.js) or the question on arriving at one (src/ui.js), the score at the Barbera (src/stadium-ball.js)
//   alert    under it: the "come back" banner (src/event-hud.js). There is one: new text replaces the old
//   moment   under that: the mission result, busted, a secret found. One at a time: the higher one hides the lower (busted, result), a secret waits for them
//   pick     under that: a tag picked up (src/suca.js). A new one replaces the old, with its count
//   feed     under that: short lines, tips and warnings (event-hud toast(), 'pd-toast'). One at a time, in a short queue: a warning goes first, the same line twice just restarts
//   map      top right: the minimap, the street, the landmark, the area and its danger (src/police.js), the clock (src/daynight.js), the online pill (src/net.js)
//   act      bottom centre: the one thing you can do here (the drink button, src/drunk.js) and the first-drive hint
//   gauges   under it: the speed and the nitro bar
// Not in a zone: the big centre words (countdown, GOL, one at a time by nature), full-screen scenes (gang block, game over, transitions), and what belongs to the world:
// the balloons (src/shouts.js) and the arrow to the target (event-hud edgeArrow), which keep inside the free part of the screen and go under the zones.
export const zone = name => document.querySelector('#hud .hz-' + name);
