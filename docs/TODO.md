# Palermo Drive: to-do

## Integration pass (lead, before publishing)

- Hunt the `computeBoundingSphere(): Computed radius is NaN` console error (some module emits NaN positions).
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
