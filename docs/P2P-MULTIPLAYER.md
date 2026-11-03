# Peer to peer multiplayer experiment

Branch experiment, off by default, not a release. Everything here is behind `?p2p` and only exists in builds made with `--p2p`.

The question: can players find each other and drive together with no server of ours, using the map tiles as rooms ("if we can figure out a way to have it dynamically creating the rooms as we travel using the nearby tiles it would be amazing")? Short answer: the rooms idea works well, and the network part is a conditional yes. It works on one Mac. It has not been tried on a real phone network, and that is the biggest open risk. Details and a recommendation are at the end.

## What was built

| Piece | Where |
| --- | --- |
| Room logic, wire format, validation, HUD (rooms, peers, how each link was made: direct, STUN or relay), name card, phrase picker, drink offer | `src/p2p/p2p.js` |
| Phrases players can say | `src/p2p/phrases.js` |
| Trystero bundled into one file (Nostr, BitTorrent, MQTT) | `src/p2p/trystero.js`, made by `tools/build/vendor-trystero.mjs` |
| Remote player drawing, split out of `src/net.js` so both clients share it | `src/remotes.js` |
| A drink that a person gave (`drunk.gift`) | `src/drunk.js` |
| Build flag and CSP | `tools/build/build.mjs` (`--p2p`) |
| Test scripts | `tools/p2p/` |
| Raw numbers | `docs/p2p/measurements.txt` |

`src/net.js` lost its drawing code to `src/remotes.js` and now calls it; the relay client is meant to behave as before. I checked that a plain build still starts it and draws its pill with no page errors (`tools/p2p/relaycheck.mjs`, against a dead address); I had no live relay to check remote players through it, but the p2p path runs the same drawing code. The default build does not contain any p2p code: with `--p2p` the game bundle grows from 2156 KB to 2584 KB raw (756 to 892 KB gzip). All three signalling strategies are in that file; Nostr alone is 73 KB raw, 27 KB gzip.

## How to run the demo

```bash
cd /path/to/palermo-drive
node tools/build/build.mjs --p2p            # writes dist/ (git ignores it), needs npm install in tools/build once
cd dist && python3 -m http.server 9801      # any free port
```

Open two or more windows side by side (a hidden window pauses the game, see below):

```
http://localhost:9801/?play&p2p&ns=demo&name=Anna
http://localhost:9801/?play&p2p&ns=demo&name=Bob
```

Drive with the arrow keys. The top left box shows the strategy, the rooms you are in with the number of peers in each, and message counters. The speech bubble button opens the phrases. The beer button offers a cicchetto or a beer to the nearest player within 25 m for 1 euro (the giver pays when the other accepts; the receiver gets one drink and the existing wobble). To see the rooms change, start the windows a few hundred metres apart on the same road and drive towards each other; cells are 500 m squares.

URL options (all optional):

| Option | Meaning | Default |
| --- | --- | --- |
| `p2p=nostr`, `torrent`, `mqtt` | which public signalling service | nostr |
| `ns=text` | rooms are separate per value, so test runs only meet each other | none |
| `name=` | your name | name saved by the relay client, else `P2P` plus 3 letters |
| `cell=500` | cell size in metres | 500 (one world tile) |
| `margin=150`, `hyst=60` | see the design below | 150, 60 |
| `mode=grid3` | join the 3x3 cells around you instead | off |
| `relays=wss://a,wss://b` | use only these signalling servers | Trystero picks 3 of its default list |

Without `ns` you are in the public rooms for that cell. Nobody else has this build today, but keep it in mind.

Tests (each through the shared browser slot wrapper, for example `/private/tmp/claude-501/withbrowser.sh node tools/p2p/border.mjs --root dist`): `join.mjs`, `cold.mjs`, `border.mjs`, `scale.mjs`, `fuzz.mjs`, `demo.mjs`. They need `--p2p` builds and open one real window per player (a background tab is throttled, and the game pauses itself when its page is hidden, so the harness stubs that).

## The room design

The world is cut into square cells of `CELL` metres (500, the world tile). A player is in the room of every cell whose rectangle is within `MARGIN` metres of the car (150), and leaves a room when the car is `MARGIN + HYST` (210) metres from that cell. Rooms are checked twice a second.

- Middle of a cell: one room. Near an edge: two. Near a corner: four. The naive 3x3 is always nine.
- Any two players closer than `MARGIN` always share a room. If B is within `MARGIN` of A, B's cell is within `MARGIN` of A, and A is in its own cell. So nobody within 150 m is ever missing, whatever side of a border they are on.
- Hysteresis stops flicker at a border: you keep a room 60 m longer than you needed it. A player whose last shared room closes is dropped after 1.5 s, and a player we hear nothing from for 6 s is dropped.
- Joining happens `MARGIN` metres before you cross, so the new room has the time it needs: 150 m is about 11 s at 50 km/h and 4 s at 130 km/h. Measured join times (below) are 0.2 to 4 s.

### Duplicates when two players share several rooms

Trystero 0.26 keeps one WebRTC connection per pair of players for the whole app and carries every shared room over it (each message is tagged with its room), and keeps that connection about two minutes after the last shared room closes. So sharing four rooms costs one connection, not four, and re-entering a room you left less than two minutes ago connects in 6 to 10 ms. The module still sends each state through one room only (the lowest room key both are in) and drops duplicates and old packets by sequence number (`rxDup` stayed 0 in all runs).

Side effect: a car driving fast through the city leaves a trail of idle connections that live two minutes each. Not measured, worth a test before building this for real.

### Results of driving across a border

Test: A parked 200 m east of a cell border, C parked 20 m west of it, B drives east at 14 m/s through the border (`tools/p2p/border.mjs`, near mode, real moving states).

- B joined the next cell's room 150 m before the border and saw the people in it 175 to 178 ms later.
- Each player appeared once and left once. No flicker.
- B lost A when B was about 510 m past it (x -790 against A at -1300), because that is where B left the last room they shared (cell edge plus 210 m). They fade out over half a second, but that is still a pop at a long distance; fading by distance would be nicer.
- 3x3 mode worked as well, with nine rooms each, but the first connection took 2.8 s instead of 0.18 s (nine rooms announced on the signalling servers instead of one or two), and several noisy "could not connect after exchanging SDP" warnings appeared even though everybody connected. Near mode is the better design. Cell size 1000 m was not tested (the option exists).

## Cost of peers

One real game page measured, everyone else a light bot page that sends the same messages (`tools/p2p/scale.mjs`). All on one Mac. The measured page stands still and sends at the full 10 Hz.

Desktop (480x270 window, no throttle):

| Peers | Frame time | Script time | JS heap | Upload, data channels | Upload on the wire incl. headers | Time to connect all |
| --- | --- | --- | --- | --- | --- | --- |
| 0 (p2p off) | 16.7 ms (60 fps) | 202 ms/s | 249 MB | 0 | 0 | |
| 2 | 16.7 ms | 192 ms/s | 281 MB | 2.3 KB/s | 3.5 KB/s | 6.6 s from page load |
| 8 | 16.7 ms | 247 ms/s | 246 MB | 9.0 KB/s | 14.1 KB/s | 7.5 s |
| 16 | 16.7 ms | 274 ms/s | 285 MB | 18.1 KB/s | 28.4 KB/s | 9.1 s |
| 30 | 16.6 ms | 269 ms/s | 446 MB | 34.0 KB/s | 53.4 KB/s | 17.1 s |

Phone profile (844x390, device scale 3, CPU slowed 4x, headless Chrome on the Mac; this is an emulation, not a phone):

| Peers | Mean frame | p95 / p99 | fps | Script time | Upload on the wire |
| --- | --- | --- | --- | --- | --- |
| 0 | 21.4 ms | 33 / 33 ms | 47 | 880 ms/s | 0 |
| 2 | 22.9 ms | 33 / 50 ms | 44 | 892 ms/s | 3.1 KB/s |
| 8 | 25.4 ms | 33 / 50 ms | 39 | 902 ms/s | 12.3 KB/s |
| 16 | 29.0 ms | 34 / 50 ms | 34 | 925 ms/s | 25.7 KB/s |

What this says:

1. Networking CPU is small. On the phone profile script time rises only from 880 to 925 ms/s at 16 peers, yet fps drops from 47 to 34. The cost is drawing the other lapas and name tags, which would be the same with the relay. A limit on drawn players (say the nearest 8 to 12) is probably needed on phones whatever the transport. That conflicts with "same graphics on desktop and phone" only if you read a player cap as a graphics setting; your call.
2. Bandwidth is the real cost, and it is per peer in both directions: about 1.8 KB/s up and 1.8 KB/s down per connected peer on the wire. At 8 neighbours that is about 14 KB/s each way, roughly 0.85 MB a minute up and the same down, about 100 MB an hour each way. On a phone's mobile data that is significant. For comparison the relay measured 7 to 750 kB per player-minute received at 255 players depending on density; the p2p player also has to upload, and pays for every neighbour, with no server fan-out.
3. Payload is not the problem, framing is. A state is 13 bytes, 130 B/s per peer at 10 Hz. On the data channel it costs about 113 bytes per message (Trystero adds the room tag and action header) and about 180 bytes on the wire. Compression would do nothing for 13 bytes. Useful savings are fewer messages (batch several updates, skip unchanged states as the relay client does, which this prototype does not, lower rate for far peers, which it does), and a shorter room tag if Trystero allows it. I would expect several times less traffic from batching; I did not measure it.
4. 30 peers all connected on Chrome with no failures and the game stayed at 60 fps on desktop. I did not go past 30, and did not test Safari, Firefox or iOS, where limits differ. Memory at 30 peers was 446 MB against 249 MB with nothing (one noisy run; the others were flat).
5. Mesh cost grows with n in each player and n squared in the room, and nothing is shared between players. This is not an autoscaling design in the sense of players splitting work. It scales in the number of players on the whole map (nothing for us to host), not in the number of players in one spot.

## Reliability

Signalling, measured with two bot pages entering a brand new room one after the other, 6 trials per service, one Mac, no page CSP (`tools/p2p/cold.mjs`):

| Service | Connected | Time from page load to first peer |
| --- | --- | --- |
| Nostr | 6 of 6 | 211 to 343 ms, median 270 |
| BitTorrent trackers | 6 of 6 | 353 to 423 ms, median 409 |
| MQTT | 6 of 6 | 242 to 298 ms, median 262 |

In the full game the same services behaved like this when a player entered a room another already sat in: Nostr 316 ms, BitTorrent 326 ms, MQTT 382 ms for the first join. Two cold game pages entering the same new area at the same time took about 4.2 s once (4 rooms at once, with some "could not connect after exchanging SDP" warnings that did not stop anything).

Problems seen:

- MQTT: two of four later joins took 10 s and logged an error. The page CSP blocks the blob workers that MQTT's library creates (console: "Creating a worker from blob: violates ... worker-src"). That is the likely cause (the same MQTT test without CSP was fast), but I did not prove it. Another reason to prefer Nostr.
- One of the default Nostr relays (`relay.layer.systems`) answered HTTP 429 (rate limit) in most runs. Trystero uses three of its 29 default relays and carries on with the others; it never stopped a join, but it shows the defaults include relays that are flaky or limiting. A real build should pin its own short list.
- The default relays and trackers are volunteer services: no guarantee, no support.

What I could not test, plainly:

- Anything outside this Mac. Every player here was on the same machine, so WebRTC found a direct local path instantly. Real players sit behind home routers and mobile carriers. Direct connection can fail for some pairs (strict NATs, carrier-grade NAT, some corporate and mobile networks) and then needs a TURN relay. I have no measure of how often. I have no access to a phone on mobile data from here. This is untested.
- Public relays under real load, and over days.
- Safari and iOS.

### TURN (Cloudflare)

From Cloudflare's TURN pages (nothing was signed up for, no credentials added): TURN is billed at 0.05 USD per GB, free when used with their SFU, and the FAQ says there is a free tier of 1,000 GB before charges start (it does not say per month on that page; the brief says per month, worth confirming on the pricing page). Credentials come from an API call that needs an API token; Cloudflare's own text suggests doing that on a backend or in Workers, and credentials can live up to 48 hours. So TURN is not "add a line to the config": a static GitHub Pages page cannot hold that token, it needs one tiny function that mints short-lived credentials. That is small, but it is a server-side piece of ours and a Cloudflare account. Trystero takes the result in `turnConfig`. Data volume: a relayed link is about 1.8 KB/s each way, about 6.5 MB an hour, so 1,000 GB is roughly 150 000 link-hours. What share of pairs would need TURN is unknown until tested on real networks.

## Privacy

Players see each other's IP addresses. A WebRTC connection hands your public IP (and, if the browser does not hide it, local addresses) to the other side, and it does so to everybody you share a room with, which may be strangers. The signalling servers (Nostr relays, trackers or brokers) and the STUN servers (Cloudflare's, among Trystero's defaults) also see your IP. Room names are hashed, but anyone can compute the hash of each cell, so the signalling service can tell which 500 m cell your IP is in. Peers learn your name, livery, exact position and speed.

Design consequences: opt in only (not on by default), say so before the first connection, no sending of anything beyond what is in the wire format, no persistent id (the peer id is random per page load; this build stores nothing). A notice would need to say: other players near you can see your IP address; so can the signalling services we use, which also learn the 500 m area you are in; names and positions are public to players nearby; list the third parties by name (the Nostr relays or trackers we pin, and the STUN server); we cannot delete data held by them; players can play without it. I am not a lawyer; if the audience includes children or the EU, check the wording.

## Security

Everything arrives from strangers, so every message goes through checks before it touches the game (`src/p2p/p2p.js`, tested by `tools/p2p/fuzz.mjs`, all with 0 exceptions):

- Exact length per message type, type byte, livery range, name length field against the real length and at most 64 bytes, positions inside plus or minus 20 km, speed clamped.
- Names are reduced to plain text (control, zero width, direction override and line separator characters removed, whitespace collapsed, 16 characters) and drawn on a canvas. They are never put in HTML. Markup stays as literal characters on the tag. Invalid UTF-8 shows as replacement characters (could be rejected instead).
- Per peer rate limit (burst 60, 40 per second): a flood of 500 states passed 60 and dropped 440. Phrases at least 1.2 s apart per peer, offers 8 s apart. At most 48 players are drawn.
- A phrase message is one byte and only an index into the fixed list, so there is no free text to abuse. A player can still repeat allowed phrases, so a local mute would be needed for a release.
- The drink offer needs the receiver's own click; the receiver only drinks after a confirmation that matches an offer they accepted; the giver pays on accept. A modified client could skip paying, which only costs the game 1 euro of in game money and affects one willing receiver.
- Nothing is authoritative. A modified client can lie about its position, speed, name and which vehicle it drives, and can pretend to be nearby. That is true of this design in general and of the relay too (the relay sends what clients say). No money, saves or race results should ever depend on what a peer says.

### Content Security Policy

The live page has `script-src 'self'`; that stays valid because the library is bundled into our own file (`src/p2p/trystero.js` through the build), not loaded from a CDN. Data channels are not governed by `connect-src` (WebRTC is outside what CSP restricts), and they worked under the page policy in every test. What has to change:

1. `connect-src` must allow the signalling WebSocket servers. Today it has `'self' https://*.run.app wss://*.run.app`. The `--p2p` build adds a bare `wss:` so any server works while testing. For a release, pin Trystero to a short list (`relays=` / `relayConfig.urls`) and list exactly those hosts, for example `connect-src ... wss://relay-one.example wss://relay-two.example`. Leaving the default list would mean about 29 Nostr hosts that rotate with the library version.
2. With MQTT only: `worker-src 'self' blob:`. Nostr and BitTorrent needed no change. I would not use MQTT.
3. STUN/TURN traffic is UDP and not covered by CSP. If TURN is added, its credential service needs its URL in `connect-src` (https).

## Recommendation

Do not drop the relay plan, and do not build the full peer to peer design as the main multiplayer yet. Consider a small, opt-in "nearby players" mode on Trystero and Nostr, but only after one round of tests I could not do here.

Why not simply replace the relay with this:

- Cost and traffic sit on each player. About 14 KB/s each way at 8 neighbours is fine on Wi-Fi and a burden on a phone's mobile data, and it grows with everyone near you. The relay sends each player one filtered stream.
- It may not connect for a real share of players (strict NATs, carriers) and the fix, TURN, needs a small server-side piece anyway.
- It depends on volunteer signalling servers that rate limit (a 429 was seen) and on third parties for STUN, and it shows each player's IP to strangers, which needs a notice.
- No authority: no moderation, bans or rate limits beyond what each client does for itself.

Why it is still worth keeping alive:

- The room design works. Driving across borders showed no flicker, new rooms were joined 150 m ahead, and a new neighbour showed up in 0.2 to 0.4 s.
- It costs us nothing to host, which is the budget constraint that shelved the relay.
- The pieces are shared with the relay path (`src/remotes.js`, the 11 byte state encoding, the phrase table, names and checks), so moving between them later is cheap.

Next steps if you want to go on, in order: (1) a real test with two phones, one on mobile data and one on home Wi-Fi, plus a laptop on another network, to find the share of failed connections; (2) batch and thin the messages, measure the bandwidth again; (3) cap drawn players and measure on a real phone; (4) pin relays, write the privacy notice, add a local mute; (5) only if (1) shows many failures, add the TURN credential function. If (1) goes badly, the answer is "no, because players cannot reliably reach each other", and the relay stays the way to go.

## Other things noticed

- First visit without `?name=` or a saved name: a stopgap name card appears (the relay client's words, saved under the same key, so the two clients share a name) and no room is joined until the player has typed one. It is a placeholder: the main game now has a name field on the Garage's driver screen (main, commit 69b747a), which saves the same key and fires a `pd-name` event; `p2p.js` listens for it like `src/net.js` does. That commit is not merged into this branch (tested here by firing the event by hand). `tools/p2p/namecheck.mjs` checks it.
- Typing into a text box over the running game hits `src/ui.js`'s key handler first: it is a window capture listener that opens the pause menu on Escape and on the letter P, so a name with a P in it ("Peppe", "Paolo") would open the menu and lose the letter. The p2p name card gets in front of it (its listener is registered earlier). The relay client's card in `src/net.js` stops the keys only at the card, which is later in the event path; I did not test it, but it probably has the same problem.

- `src/ui.js` pauses the game when the page becomes hidden. Normal and sensible, but it means a player in a background window sends nothing (my tests were silent for a while because of this).
- The game's `window.game` debug object has no `game` state, which made that hard to spot; not changed.
- The relay client sends a state only when it changed, p2p sends every 100 ms regardless. Cheap to fix in a real build.
- Names with invalid UTF-8 are accepted with replacement characters.
- `tools/build/package.json` now lists the three Trystero packages as dev dependencies, used only to rebuild `src/p2p/trystero.js`.

## Real device finding: players lost each other after a pause (fixed)

First test over the internet (phone and laptop, different networks, link shown as `stun`): they connected and saw each other. After one of them paused (the Garage is a pause, so buying a vehicle is one) the other stopped seeing them for good. A plain page refresh was not the cause (tested on its own, the refreshed page and its partner find each other again in about a second).

Cause: the game sends nothing while paused. After 6 s without a STATE the other side dropped the player, and the drop deleted the peer record although the data channel was still open. Records were only created when a peer joined a room, so everything that arrived afterwards from that player was rejected as unknown (`rxBad` counted up, the phone showed `peers 0` with `1` peer in every room). Fix: a quiet player is only taken off the street (`shown = false`), the record stays while the player is in a room, and the next STATE shows the car again with the name and livery already known. Test: `tools/p2p/resume.mjs` (refresh, then a 10 s pause with a livery change, on each side). Before the fix both pause cases fail and stay failed; after it they pass.

## Real device finding: everybody was drawn as a lapa (fixed)

The shared remote renderer (`src/remotes.js`) only ever built the calessino, and the p2p INFO message carried a livery index into the sender's own livery list, with no vehicle. A player on a motorbike was therefore drawn as a lapa. INFO is now `[1][vehicle u8][livery u8][nameLen u8][name]`: the vehicle indexes `VEHICLES`, the livery indexes that vehicle's `LIVERIES`, and the receiver draws any of the seven vehicles through the shared `buildVehicleModel` (bikes and the hatchback included, with their own exhaust flames). Both values come from the network: an unknown vehicle is a lapa, an unknown livery its first one. A change while connected sends a new INFO to everyone in the rooms and the remote model is rebuilt (in about 0.1 s in the test; all models live in the game bundle, so nothing is downloaded, and the first build of a vehicle costs about 1 ms). Not carried yet: custom colours (a custom livery goes out as the vehicle's first livery), fitted parts (spoilers, neon), wheelies and pitch. Test: `tools/p2p/vehicles.mjs`.

A refreshed player is drawn by the other side about 0.7 to 0.8 s after the reload starts, and the refreshed page sees the other player as soon as it has loaded (2.6 to 2.7 s), measured on one machine against the public Nostr relays.
