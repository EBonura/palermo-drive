# The Barbera ball

`src/stadium-ball.js`, created by `createStadium` in `src/stadium.js` and updated from there only while the lapa is on the pitch (the same `on` test as the crowd's hype). Away from the pitch nothing runs: the mesh, the shadow and the score card are hidden and the score of the visit is dropped.

- One sphere (radius 1.5 m, rosanero and black panels), one shadow disc, no allocation per frame. Physics in 10 ms substeps: gravity, bounce (0.62), rolling friction, side boards and end lines of the pitch rectangle (the pitch's own frame, from `obb` of the OSM playing area, like the goals in `src/lmc-a.js`), the four goal posts as small circles.
- The lapa is two circles along its body; a hit gives the ball the relative speed along the contact normal plus a share of the lapa's own speed and a small lift.
- The goal frames of `src/lmc-a.js` block the lapa only; the ball ignores them and goes through the mouth into the net. GOL = ball past the goal line (52.5 m from the centre), between the posts (3.7 m) and under the bar (2.44 m).
- On GOL: the banner, the stands held at full hype for 7 s, a chant balloon from a seat in front of the camera, +10 points (+5 per goal inside 45 s of the last, up to +25), a EUR 2 credit through `pd-fare` at most once every 20 s, the best score saved in `localStorage` (`palermoDrive.stadium.best.v1`), the ball respawns at the centre after about 3 s. Event `pd-stadium-goal` `{ n, points, add }`; the secret achievement `primo-gol` listens to it.
- Test hook with `?debug`: `window.__ball` (`state`, `set(x, y, z, vx, vy, vz)`).

Palermitan lines to be checked by the owner: the achievement title "Primu gol ô Barbera" and note "Facisti gol cû lapa ô Barbera.", the GOL chants ("GOOOOL!", "Gol! Gol! Gol!", "Alé alé rosanero!", "FORZA PALERMO!"), the "punti / serie" words on the banner (Italian; English when the game is in English).
