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
- **Switch vehicle** (Hubert's idea): 3 lape (Calessino + the current liveries, a cargo Ape, an Ape 50) and
  3 motorbikes (a Vespa, a scooter like a Liberty/SH, a small motorbike), chosen in the Garage and maybe
  swapped in the street; bikes need their own handling and rider sprite/model.
- **Tamarro tuning garage** (Hubert's ideas): "macchine tasce" (loud tuned small cars: lowered, big
  exhausts, stickers, tinted windows, rims), SH-style big-wheel scooters (the Palermo classic; generic
  look, no Honda badges), and modded Ape with spoilers (alettoni), underglow neon, chrome, spinners,
  stickers, horn upgrades and subwoofers; parts and colours picked in the Garage, unlocked with fares.
  Same vehicle system as the switch above, cosmetics as layered parts on each model.
- Edge-of-screen hint when the taxi destination is behind you.

## Later (not in the current pass)

- **Traffic system**: moving cars, scooters and buses following the OSM road graph (one-ways, lanes,
  junction priority, traffic lights where OSM has them), reacting to the player, despawning out of view.
- **Pedestrian system**: people walking sidewalks and pedestrian streets, crossing at zebras, crowds in
  the markets (Ballarò, Vucciria, Capo) and on Via Maqueda in the evening; scatter out of the car's way.
  Retro look: **2D billboard sprites in 4 directions** (front/back/left/right, frame chosen from the angle
  between camera and walking direction, 2-3 frame walk cycle), original pixel-style art drawn in code,
  several body/clothing variants (nonne in black, market vendors, tourists, kids), instanced for cost.
  Replace today's static low-poly pedestrians in src/props.js with the same sprites.
- **Carretto siciliano**: the painted Sicilian cart (yellow/red wheels, carved and painted panels with
  chivalric scenes, plumed horse harness) as a hero prop, parked near the Cattedrale/Quattro Canti and
  as a slow horse-drawn vehicle in the traffic system.
- **Lapa (Piaggio Ape)**: more variety beyond the current Ape and Apetaxi (fruit and vegetable sellers
  with crates, the "pane e panelle" and "sfincione" street-food Ape, loudspeaker on the roof), parked
  and later in traffic.
- **Horse carriages** (carrozze) for tourists around the Cattedrale and Teatro Massimo.
- **Prop collision**: parked cars, bins, scooters, trees and lamps are drive-through today.
