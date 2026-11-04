// The HUD's places: one for each kind of message, so that two kinds can't land on each other. The zones are in index.html, their CSS in src/ui.css;
// a zone is a flex column, so what stands in it pushes the rest along and nothing positions itself. Every module asks for its zone here.
//   (the slim bar top left, src/ui.js: the menu button, play or pause, next track and what is playing; it also exists on the menus, so it stays out of #hud. It grows to the right when opened, so nothing else stands in its row)
//   social   bottom left (above the steering pads on a touch screen): the multiplayer section, only while online (src/p2p/panel.js): the last things said, then the capsule with the player count and the talk button
//   status   left, under that bar: the coordinates (src/coords.js)
//   (top centre: on a touch screen, and on a narrow desktop window, the whole obj..pick..feed column moves left instead, under the bar and ending before the map capsule, src/ui.css)
//   obj      top centre: the mission card (src/event-hud.js) or the question on arriving at one (src/ui.js), the score at the Barbera (src/stadium-ball.js)
//   alert    under it: the "come back" banner (src/event-hud.js). There is one: new text replaces the old
//   moment   under that: the mission result, busted, a secret found. One at a time: the higher one hides the lower (busted, result), a secret waits for them
//   pick     under that: a tag picked up (src/suca.js). A new one replaces the old, with its count
//   feed     under that: short lines, tips and warnings (event-hud toast(), 'pd-toast'). One at a time, in a short queue: a warning goes first, the same line twice just restarts
//   map      top right: the map capsule (#pd-card), one dark shape with the round minimap as its right end and the words in a column to its left (#pd-info): the clock, the street or the landmark beside you (src/main.js),
//            the area with its danger diamonds and, right under them, the police line (src/police.js); under the capsule, the online pill (src/net.js). A tap on the map opens the big map (src/ui.js)
//   act      bottom centre: the one thing you can do here (the drink button, src/drunk.js) and the first-drive hint
//   gauges   under it: the speed and the nitro bar, one compact row
// Not in a zone: the big centre words (countdown, GOL, one at a time by nature), full-screen scenes (gang block, game over, transitions), and what belongs to the world:
// the balloons (src/shouts.js) and the arrow to the target (event-hud edgeArrow), which keep inside the free part of the screen and go under the zones.
export const zone = name => document.querySelector('#hud .hz-' + name);
