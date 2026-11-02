# Palermo Drive: to-do

## Integration pass (lead, before publishing)

- `computeBoundingSphere(): Computed radius is NaN`: no NaN in the scene; most likely src/context.js computing
  a bounding sphere on an empty chunk before checking it. Guard with a length check.
- Pause the game while the portrait rotate prompt is showing.
- Sky and haze read pale grey from altitude (title flyover): retune turbidity/fog for high cameras.
- Camera pull-in only tests building walls; props between camera and car block the view.
- Hook the shell's `pd-gesture` event / `vehicle.unlockAudio` so audio starts on the title tap.
- Add the shell's meta tags to index.html with the real Pages URL; re-run `assets/ui/make-cover.sh` last.
- Revert buildings.js walls to FrontSide: DoubleSide was only added so free screenshot cameras inside a
  footprint look clean; the gameplay camera never enters buildings and backfaces cost fill rate on phones.
- Far terrain: tint mountains toward the hazed blue (#7297b4) with distance, per the style guide.
- Port: context buildings on the piers float because the coarse far grid puts quays below sea level;
  needs quay/pier ground (the whole-city tiles should solve it).
- Collision for Fontana Pretoria (`window.__landmarkKeepout`), Teatro stairs and lions, Cathedral porch.

## Resume here (2026-10-31 evening)

- Owner will provide a street-level imagery key (Google Street View Static API, or a Mapillary token) so the 300-view comparison can
  be done for real; the survey (docs/faithfulness/survey/) compared only ~20 views against Street View because the browser pane
  returned black frames. Redo it with the key: fetch the view per viewpoint, compare, write findings (images stay out of the repo).
- In progress when stopped (see each status note): terrain (docs/faithfulness/terrain.md: buried mountain roads, load-order race in
  world.js computeShape, Pellegrino shape, Monte Gallo cliff, Mondello at sea level), streetscape (docs/faithfulness/streetscape.md:
  paving halos, verges, motorways/medians/guard rails, Regione Siciliana gap), vegetation (docs/faithfulness/vegetation.md: species),
  missing building footprints (docs/TILES.md "Footprint gap filling").
- Mondello leftovers (docs/faithfulness/mondello.md): big block w73411051, Hotel La Torre, beach width.
- Landmark leftovers (docs/faithfulness/landmarks.md): Cuba, Eremiti, Normanni front, Stazione Marittima, stadium stair ramps and fence collision.
- Mondello has no bus: AMAT 806 isn't in OSM.
- Phone budget: props 260-340k tris, thin rubbish piles first if phones struggle.

## Faithfulness (owner, standing rule)

- Every visual change is compared side by side with Google Maps satellite/Street View (look only) and photos of the same viewpoint.
- After the current faithfulness round (ground, buildings, landmarks outside the centro): run an ADVERSARIAL review by a fresh agent that did
  not do the work. It shoots a fixed set of viewpoints across the whole city, compares each with references, and lists everything still off
  (missed places, wrong heights, colours, street furniture, land cover, landmarks). Then fix that list and re-shoot.

## Waiting on the owner

- **Deploy the multiplayer/stats relay** on the new bonniestudiosdev@gmail.com GCP account (owner said "later"):
  follow server/DEPLOY.md (us-east1 for zero egress cost, kill switch at a few euros), then set RELAY_URL in
  src/net.js. Until then multiplayer and player stats stay off.
- **More photo facades**: a Mapillary access token and/or the owner's own frontal photos of key buildings.

## Next up (owner + friends' ideas)

- **Explorable outskirts**: La Favorita (park, avenues, tracks, Palazzina Cinese), Monte Pellegrino (the
  switchback road to Santa Rosalia's sanctuary and Castello Utveggio, smooth terrain on the hairpins), the ZEN
  insulae; off-road driving on dirt and park ground. Being handled by the streaming work; finer DEM for the
  mountain only if needed (ask the owner before downloading).
- **Stadio Renzo Barbera** (Hubert's idea): model the stadium properly when the whole city loads, and make it
  enterable: drive in through a gate, onto the running track/pitch, stands full of rosanero tifosi sprites.
- DONE: **Switch vehicle** (Hubert's idea): 3 lape (Calessino + the current liveries, a cargo Ape, an Ape 50) and
  3 motorbikes (a Vespa, a scooter like a Liberty/SH, a small motorbike), chosen in the Garage and maybe
  swapped in the street; bikes need their own handling and rider sprite/model.
- DONE: **Tamarro tuning garage** (Hubert's ideas): "macchine tasce" (loud tuned small cars: lowered, big
  exhausts, stickers, tinted windows, rims), SH-style big-wheel scooters (the Palermo classic; generic
  look, no Honda badges), and modded Ape with spoilers (alettoni), underglow neon, chrome, spinners,
  stickers, horn upgrades and subwoofers; parts and colours picked in the Garage, unlocked with fares.
  Same vehicle system as the switch above, cosmetics as layered parts on each model.
- Edge-of-screen hint when the taxi destination is behind you.

## Later (not in the current pass)

- Multiplayer remote players: use vehicle.buildVehicleModel({type, livery, parts}) and send car.lean + look (only when multiplayer comes back).

- **Traffic system**: moving cars, scooters and buses following the OSM road graph (one-ways, lanes,
  junction priority, traffic lights where OSM has them), reacting to the player, despawning out of view.
- **Pedestrian system**: people walking sidewalks and pedestrian streets, crossing at zebras, crowds in
  the markets (Ballarò, Vucciria, Capo) and on Via Maqueda in the evening; scatter out of the car's way.
  Retro look: **2D billboard sprites in 4 directions** (front/back/left/right, frame chosen from the angle
  between camera and walking direction, 2-3 frame walk cycle), original pixel-style art drawn in code,
  several body/clothing variants (nonne in black, market vendors, tourists, kids), instanced for cost.
  Replace today's static low-poly pedestrians in src/props.js with the same sprites.
- DONE: **Carretto siciliano** (board item c6): the painted Sicilian cart, yellow wheels with red spokes, side boards with a duel of paladins, the harbour under Monte Pellegrino and Etna, a Trinacria dashboard and a
  VIVA PALERMO back board (one 512 x 256 canvas drawn in code, assets/traffic/carretto-art.js), a bay horse with a plume, pompons, a blue saddle cloth and brass bells (model in assets/traffic/models.js, about 1.7k triangles).
  Two ways to meet it: standing (src/carretto.js: one at the Cattedrale garden, one at the corner of Piazza Pretoria, solid for the lapa, with an LPC carrettiere sitting on the plank; `?cartat=x,z,th;...` moves them) and
  as the one slow cart of the traffic (src/carrozze.js and src/traffic.js tourPlan('carretto'): a loop Piazza Sant'Anna, Piazza Garraffello, Piazza Caracciolo, 1.3 km, one at a time, calls "U carrettu sicilianu, signuri!").
  The loop only exists while those tiles are in the road graph (a start at the Quattro Canti has it, a start 300 m east of the Vucciria does not). Ballaro's own graph node cannot be a stop (the graph lets you leave it, not come back).
- DONE: **Lapa (Piaggio Ape)** variety in the traffic: the fruit seller's Ape (crates stepped up with oranges, lemons, melons, a striped parasol), the sfincione Ape and the pane e panelle Ape
  with a horn loudspeaker on the roof that calls out now and then (src/vendors.js: a short line in the speech balloon, one at a time, 9 s apart at least, 30 to 70 s per vehicle). Open: parked ones.
- DONE: **Horse carriages** (carrozze) for tourists: a closed loop Cattedrale, Quattro Canti, Teatro Massimo found in the road graph (traffic.js tourPlan), at most two carriages on it, each with an
  LPC coachman (type `cocchiere`, top hat) and one or two tourists seated on it (src/carrozze.js); the coachman calls "Giru in carrozza!" now and then. The loop only exists while those tiles are loaded.
- **Prop collision**: done (board item p5), see the table in docs/TILES.md, "What the lapa does to props". Open: no planters exist yet; garage doors are not known to the parked-car placement.
