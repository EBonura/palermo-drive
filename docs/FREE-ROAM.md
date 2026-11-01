# Free roam, menus and events: agreed design (2026-11-01)

Decided with the owner in chat. Build from this; anything not covered here, ask the lead instead of guessing.

## Shell

- **Main menu**: Guida (opens the start picker), Garage, Opzioni, Crediti. No "Continua".
- **Start picker**, two views:
  - **Map**: an illustrated 2D map of the whole city drawn from the game's own data (coast, roads, parks, shaded Monte Pellegrino), pan and
    pinch zoom. Start points are pins; tap one and a small popup opens with the name and "Parti da qui". A second layer shows events with
    their own icons, with a show/hide toggle on the map.
  - **List**: one list grouped by quartiere, each neighbourhood a header with its points of interest under it; tap either to start there.
- **Transitions**: rosanero (pink and black) squares flipping in a diagonal wave, with a spinning lapa while loading. Used between every mode
  change (menu to game, game to menu, change start point, event start). The screen stays covered until the world around the start has
  streamed in, so loading never happens on screen.
- **In game**: one menu button. It opens a side menu from the right, with the game still running visibly behind it so changes show
  immediately. Contents: Riprendi, Cambia partenza, Garage, Opzioni, Radio, Collezioni (SUCA/800A tags, pizzette, races won), Esci al menu.
- **Driving HUD**: speed and minimap, NOS bar, clock, horn button on phones (desktop keeps the key). Everything else moves into the menu.

## One mode: free roam

The Turisti and A Favorita modes go away as modes and become objectives in the world. Events start when **people call you**: a character
waves or shouts from the kerb (Benny outside the pizzeria, racers revving at the start line, tourists hailing a ride); stop next to them to accept.

- **Fares** (tourists in the centro, regular taxi rides, and tourists asking to go "a pulle", by day and by night, which absorbs the old A
  Favorita mission): timer plus tip; the tip grows with speed. Hitting pedestrians or other cars does **not** reduce the pay. Pay goes to
  Garage unlocks as today.
- **Urgent long fares**: rare passengers who must cross the city fast (airport, hospital, stadium before kick-off) with a tight timer.
- **Food collect/chase events**: "Benny ha perso le sue pizzette! Aiutalo a ritrovarle". Two phases: a timed hunt for about a dozen items in the
  streets nearby, then a chase after a runaway scooter dropping the rest; bring them back. The same event type runs for many food places:
  Benny (Via Goethe), some famous real places taken from OpenStreetMap, and invented Palermitan-style places used to spread events evenly
  across the map. Each place has its own item (pizzette, arancine, panelle, cannoli...).
- **Races**: grid start, 3/2/1/VIA!. Sprints A to B on Viale Regione Siciliana; lap races at the Universita and on Viale dell'Olimpo.
  Opponents: tuned cars and lape, scooters, carrozze coi cavalli. The existing night "Corse clandestine" (src/vehicle-events.js) is rebuilt
  on the same race system, night only, where it is today.

## World fixes

- **Wall tags**: SUCA and 800A (800A uses the same spray styles as SUCA), across the whole city, denser in popular areas (centro, Borgo,
  ZEN), more of them and bigger so they're easy to see. Still collectible.
- **Gates**: every Palermo gate that really is an arch becomes a drivable-through arch: at least Porta Nuova, Porta Garibaldi, Porta dei
  Greci, Porta Carini, Porta Sant'Agata, checked against photos. Porta Felice stays two open pylons (the real one has no top, so the
  Festino carro can pass).
- **Charleston (Mondello)**: fix the entrance columns' position, spacing and orientation against photos of the real building.
