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

Tests (each through the shared browser slot wrapper, for example `/private/tmp/claude-501/withbrowser.sh node tools/p2p/border.mjs --root dist`): `join.mjs`, `cold.mjs`, `border.mjs`, `scale.mjs`, `fuzz.mjs`, `demo.mjs`; and `stress.mjs` with `relay.mjs` and `botgame/` for many players on local relays (section "Stress test" below). They need `--p2p` builds and open one real window per player (a background tab is throttled, and the game pauses itself when its page is hidden, so the harness stubs that).

## The room design

The world is cut into square cells of `CELL` metres (500, the world tile). A player is in the room of every cell whose rectangle is within `MARGIN` metres of the car (150), and leaves a room when the car is `MARGIN + HYST` (210) metres from that cell. Rooms are checked twice a second. (This is the rule used without presence; with it the rooms are chosen by player count, see "The closest players" below.)

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

## The closest players (4 Nov)

The rooms above found only players within about 500 m, so two players in different parts of the city never met and a quiet server felt empty. The limit is now a number of players, not a distance: `MAX_PLAYERS` (8, one constant in `src/p2p/p2p.js`) other players are held at once, the closest ones wherever they are. With three players online in the whole city, each sees the other two.

**How it works.**

1. *Who is online and where* travels as plain Nostr events, no WebRTC (`src/p2p/presence.js`). Every player publishes one small event: kind 30078 (NIP-78 application data, replaceable, so a relay keeps one per player), a NIP-40 expiration tag, a key made fresh at every page load and thrown away, and as content the list of rooms they are in (`3,0,0 4,0,0`: cell x, cell z, shard, home room first). No name, no exact position, no IP. Everybody reads the same city-wide list (a topic named after the app and `?ns=`). A new reader gets the whole list at once, because relays store the events (Trystero's own announcements are ephemeral: nobody who is not subscribed at that moment sees them).
2. *Who to hold* (`src/p2p/rooms.js`). Each client walks the list from the closest player outward and joins rooms, one at a time (at least 4 s apart), as long as the room brings somebody new and the players held stay within `MAX_PLAYERS`, each counted once however many rooms they are in. A room with nobody new in it is not joined. Leaving goes by the real connections and not by the list, which is up to 15 s old: a room stays until it is no use (nobody in it; everybody in it also shares a lower room with us, the lowest shared room being the one both ends keep; everybody in it past the cap or silent for 30 s), until a clearly closer room takes its place (150 m closer than the closest player that room alone connects us to, swaps at least 20 s apart, doubling while the car stays put), or until there are really too many connections. A room left is not visited again for 30 s, doubling each time. So a pair that is connected stays connected while they drive about, and the rooms come to rest. Why it was not like that at first: see "Stress test".
3. *The cap in a crowd.* A Trystero room connects you to everyone in it, so a crowd in one cell would be a mesh of everybody. A cell is therefore cut into shards (rooms `cell`, `cell:1`, `cell:2`...): a player's home room is the lowest shard that has at most `MAX_PLAYERS` others in it (counted from presence), so no room has more than 9 members. When several players take the same shard in the same second and it overfills, the visitors go at once, then the members sort themselves by id, the first 9 stay and the rest move to the next shard, with no talking needed (`tools/p2p/crowd.mjs`: five pages in one cell with `?maxp=2` end as rooms of 3 and 2, nobody connected to or drawing more than 2). Players do not visit another shard of their own cell. Two shards of a cell that fit into one become one. A player alone with nothing that fits them (9 in a room and 1 left over) gets company: the last of the full room by id gives up its place, so 9 and 1 become 8 and 2 (at most once a minute per player). A room that the list says is occupied but where nobody turns up in 25 s (a player who left, or a forged entry) is left and ignored for 2 minutes. On top of the rooms, the players actually connected are ranked by distance: only the closest `MAX_PLAYERS` are sent to, drawn or listened to; and more than `MAX_PLAYERS + 2` connected for 10 s makes the farthest room go. What is capped and what is not: drawing and sending are capped hard (every 500 ms), the rooms are capped by the list (which lags a few seconds, so a flash crowd can overshoot for a few seconds until the id rule sorts it out), the number of WebRTC connections is capped by those two together, not by a hard limit in Trystero. Inside a crowd in one cell, which players you hold is decided by who arrived where, not by metres, and players in different shards 40 m apart do not see each other (reported, not fixed: a room is all or nothing).
4. *Far players are cheap.* A player beyond 400 m (back to a car inside 400 m, with 80 m of hysteresis) is a cyan ring with a name on the minimap and the big map, and no car, no tag, nothing built. They are sent to every 2.5 s beyond 1.2 km and every second up to there (the near rates are unchanged: 10 Hz inside 150 m, 5 Hz to 350 m). Offers, phrases and the "is near" line need a player within 25 to 60 m, as before. A far player who drives up is the same record in the same room: `src/remotes.js` builds the car and fades it in, nothing is added or removed (`tools/p2p/near.mjs` checks one record on each side). A player who leaves is gone in 1 to 2 s (the data channel closes), and the list entry is gone with the goodbye event or at most 2.5 beats later.
5. *Without presence* (another strategy, `?presence=off`, or no relay answering for 3 s) the old rule applies: the rooms within 150 m, shard 0. So a relay problem costs the far players, not the near ones.

Tests: `near.mjs` (two pages 5 km apart find each other and show on the minimap and big map with names, a third nearby is a car, hand-over both ways with one record, no ghost), `closest.mjs` (with `?maxp=1` the closest player only, and the swap when somebody closer turns up), `crowd.mjs`, `hidden.mjs` (background stops presence), `traffic.mjs` and `presence-sim.mjs` (the numbers below), `rooms-sim.mjs` (the room choice alone, no browser, no relay, many seeds: does it come to rest?) and `guard-check.mjs` (the safety limit). `--local` on any tool that uses `start()` in `tools/p2p/lib.mjs` points the five pinned relay names at five local relays and refuses every other name, so a tool with more than a few pages does not touch the public relays. `default.mjs` and `states.mjs` still pass: the sockets of presence are in the list that must be empty after "Gioca da solo". Time to meet far away is about 10 to 30 s in the tests, mostly the 15 s least gap between two presence events plus a few seconds of WebRTC; two players who load at their spots and stay meet sooner.

**Traffic and manners.** Two relays out of three (`PRESENCE_RELAYS`: nos.lol, nostr.stakey.net, nostr.chaima.info, the ones that accepted and stored the event when tried), picked at random per player: any two of three share one, so any two players share a relay. Own sockets (not Trystero's), so a relay that refuses this kind cannot cost the game its room signalling. One event per player per minute, plus one when the room list changes (at most every 15 s). With a crowd the beat stretches (a player aims to receive at most about 1.6 events per second per relay, `RX_EVENTS_PER_S`; the beat is 60 s up to 96 players and grows with the number online after that), and the list remembers at most 400 players: past a few hundred online at once the topic has to be split by region (not built). A page that is paused or in the background for 60 s says goodbye and closes its two sockets; a player who goes solo does the same at once; nothing is opened before the yes on the name card. Trystero's own room announcements still go on in a paused or background page (as before this change).

Measured (Mac, headless Chrome, real public relays, `tools/p2p/traffic.mjs`, `presence-sim.mjs`; one client's WebSocket frames, both directions):

| Players online | Presence frames per minute | Presence bytes per minute | Room signalling per minute |
| --- | --- | --- | --- |
| 2 (two real pages) | 5 | 2.3 KB | 74 frames, 27.9 KB (3 rooms) |
| 10 (2 real, 8 simulated, only 5 got through the rate limit below) | 10.7 | 5.1 KB | 366 frames, 140 KB (5 rooms, most of them empty rooms of simulated players) |
| 10 simulated, one reader (`presence-sim.mjs`, 3 minutes) | 14 to 21 events | 6.5 to 9.8 KB | |
| 100, estimated | about 200 events | about 90 KB (1.5 KB/s) | unchanged: it depends on the rooms joined, not on the city |

An event is about 460 bytes. The 100 figure is 100 players x about 1.5 events a minute x 1.33 (a reader hears two of the three relays, and each player is on two of them), not measured. Each room costs what any room costs: about 25 frames and 9 KB a minute of relay signalling (an announcement every 60 s on each of the five relays), and a client has at most `MAX_PLAYERS` rooms plus its home.

**Did a public relay refuse or limit us?** Yes. `nostr.stakey.net` answered `rate-limited: too many requests` to presence events while a few pages from one address were publishing (about 1 event per minute from each of two pages, together with their room announcements; 10 simulated players from one address were refused about a quarter of the time). `nos.lol` and `nostr.chaima.info` never refused. The client backs off for 60 s on that relay and says the same thing again afterwards (the other relay got it meanwhile). Real players will not share an address, so this was our own test traffic, but it shows the limits are real and small. `relay.bitmacro.cloud` never answered an event (no OK, no refusal) and is not used for presence. Nothing was blocked or banned. The tests that need steady behaviour use `relays=wss://nos.lol,wss://nostr.chaima.info`.

**Choosing `MAX_PLAYERS` = 8.** Phone profile (844x390, device scale 3, CPU slowed 4x, headless Chrome on a Mac that was also running other agents' browsers, so the frame times are noisy; this is an emulation, not a phone; `tools/p2p/scale.mjs --phone`, every peer near and sending at 10 Hz, which is the worst case):

| Others held | Mean frame | fps | Script time | Wire, up / down |
| --- | --- | --- | --- | --- |
| 0 | 18.6 ms | 54 | 877 ms/s | 0 |
| 4 | 17.2 ms | 58 | 761 ms/s | 6.7 / 7.1 KB/s |
| 8 | 17.7 ms | 56 | 846 ms/s | 13.2 / 14.2 KB/s |
| 12 | 19.0 ms | 53 | 923 ms/s | 18.2 / 21.4 KB/s |
| 16 | 20.3 ms | 49 | 928 ms/s | 25.2 / 29.1 KB/s |

Up to 12 the frame time is inside the noise; 16 costs about 2 ms and 5 fps. The real cost is traffic, about 1.6 KB/s each way per near player on the wire, about 0.8 MB a minute each way at 8 near players (50 MB an hour). Far players cost almost nothing (a state every 1 to 2.5 s, no car drawn), and a typical hold is a few near and a few far. 8 is the largest value whose worst case stays below 15 KB/s each way on mobile data; the code allows 1 to 40 (`?maxp=`). Not measured: a real phone, a real mobile network, Safari or iOS.

**Who can learn what** (the facts behind the name card's sentence):

- The players you are connected to (up to `MAX_PLAYERS`, the closest to you anywhere in the city, so a player 5 km away can be one when few are online) get your IP address from the WebRTC connection, and see your name, vehicle, position and driving. The connection lasts while you share a room and up to 15 s after. Players choose their own rooms, so a player can connect to you because you are among their closest even when they are not among yours: your connections can be a few more than 8 for a moment (home room up to 8 others, rooms you visit counted to 8 in total, the rest dropped after 10 s), and never everybody.
- Anyone who reads the presence topic (any player, any relay operator, anyone with a WebSocket client) can see which 500 m cells are occupied, which cells each online player holds (their own first), a random id for this visit and the time. That is the whole list of online players and where they are, to 500 m, with no names. Before this change the same could be worked out by hashing every cell name, but now it is a plain list, and a relay that ignores the expiration tag keeps the history for as long as it likes.
- Relay operators also see your IP as a client of their relay, as before, for the room signalling (five relays) and now for presence (two).
- Nobody learns your IP from presence, and a player who is not among your closest and whose closest you are not never gets it.
- Nothing logs, displays or sends a peer's IP: `wire()` reads only the candidate type (host, srflx, relay) to count links; the debug box shows counts; the play log sends the name and the player count only.

## Stress test: 8 to 64 players (4 Nov)

The question: what does the shipped netcode do with 16, 32 and 64 players, and how far can the cap be pushed? Measured with `tools/p2p/stress.mjs` (header: arguments and how long a run takes). Raw numbers: `docs/p2p/measurements.txt` (entries "=== stress.mjs ...", then the notes added by hand at the end). Nothing in `src/` was changed. The fix that followed, with numbers from before and after it, is under "After the fix" at the end of this section; everything before that describes the code as it was.

**What was run.** Everything on one Mac (headless Chrome, 14 cores, other agents running at the same time, load average 12 to 30 during part of the runs, 190 during one storm). Per run: 5 local Nostr relays (`tools/p2p/relay.mjs`, 127.0.0.1 only, throw-away TLS certificate because the shipped client only accepts `wss://` in `?relays=`), passed as `?relays=`; five like the five pinned in `src/p2p/relays.js`, the first three also carrying presence as `PRESENCE_RELAYS` does. The shipped build's page policy lists only the pinned hosts, so the test serves the build through a small proxy that adds the local addresses to `connect-src` in `index.html`; the build itself is untouched. Chrome is started with every name except 127.0.0.1 refused, so nothing could reach a public relay, a STUN server or the play stats service. Checked in every run: a public address fails to resolve, a STUN server gives no server-reflexive candidate, the network log shows only 127.0.0.1 sockets and requests, no refused lookups. The play log was never reached (`?ns=` and `navigator.webdriver` both block it; the refused-lookup count was 0). Players used a private `?ns=`. The one run on the real relays is described below (4 players).

**Who the players were.** In each run 1 full game page (2 from 32 players up) and the rest light bots. Never to be read as "64 game clients". A bot is the real `src/p2p/p2p.js`, `presence.js` and Trystero, bundled with drawing, garage and language stubbed (`tools/p2p/botgame/`): same room choice, shards, presence, rate limits, wire format and timers, so the same traffic. What they do not do: build or draw cars, run the game, run the garage. Their STUN is switched off (loopback). Eight bots share one browser page (one iframe each, so each has its own id and its own Trystero). Check of parity: in the 8 player crowd a real page sent 70 messages a second and 7.9 KB/s on its data channels, a bot 70.6 and 8.0. (`tools/p2p/bot.html`, the older bot, joins one fixed room and sends 10 Hz to everybody; it cannot show shards or presence, so it was not used.) The real pages start unnamed and are given a name at their start time, which is what makes them join, as in the game; their STUN names were refused, so they connect on host candidates only.

**What this cannot show.** One machine: no NAT, no mobile network, no packet loss, no real latency (one way between bots was 1 ms at p50), no Safari or iOS, and no TURN. WebRTC found its direct path instantly, as on any one machine. What is emulated: the phone profile (844x390, CPU slowed 4x) as in the older measurements. Network throttling was not applied. A busy Mac makes every timing in the tables worse than a quiet one, not better, and the Mac was shared. The test that would close the gap: 8 to 16 real people on different networks (home Wi-Fi, mobile data, at least two phones) in one spot for ten minutes, with the stats of `stress.mjs` read from the debug box, on the real relays (the owner's call, it is real load on volunteers).

**Situations.** A: everyone in one spot, arriving over 20 s, then 60 s steady. B: spread over the city, each wants its closest players. C: everyone arrives in the same second, after a minute half of them drive off at 40 m/s and come back. D: one player joins every 3 s. E: 50 m/s back and forth over cell borders in a 1.6 km corridor. Only A and D finished at all four sizes. The rest, and why:

### Results at the shipped cap of 8

"First peer" is the time from a player's own start to its first connected player (the very first player in has nobody to meet and is left out). "Seen" is to the first car/dot shown. "Connected" counts WebRTC peers at one time; the cap says 8. Relay figures are what the five local relays saw in the steady 60 s (45 s in C and D, the relay frames are in plus out); "busiest" is the most loaded relay, and per hour is that rate times 3600 (an extrapolation, assumes the same N stays for an hour).

**N = 8** (1 game page, 7 bots)

| | First peer / seen, median (max) ms | Shards at the end | Max connected at once | Max members in a room (limit 9) | Alone | Room joins per player per min | Relay frames/s (all 5 / busiest) | Busiest relay per hour | Not received | Update gap p99 (<150 m) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A crowd | 320 (365) / 320 | 1 of 8 | 7 | 8 | none | 0 | 8.6 / 2.1 | 7,600 frames, 4 MB | 0 % | 101 ms |
| D rolling | 317 (367) / 317 | 1 of 8 | 7 | 8 | none | 0 | 8.4 / 2.6 | 9,400 frames, 4 MB | 0 % | 101 ms |
| C wave | 592 (751) / 610 | 1 of 8 (6 identical rooms stay joined) | 7 | 8 | none | 0 after settling | 44 / 9 | 32,000 frames, 15 MB | 0 % | 101 ms |
| E fast | 866 (2067) / 889 | 5 (2,2,2,1,1) | 7 | 8 | none | 26 | 3000 / 601 | 2.2 million frames, 964 MB | 0.7 % | not measured |
| B spread | 693 (2343) / 693 | 8 (1 each), 13 rooms | 7 | 8 | none | 35 | 3706 / 742 | 2.7 million frames, 1193 MB | 3.4 % | 2761 ms (far players are sent to every 1 to 2.5 s by design) |

**N = 16** (1 game page, 15 bots)

| | First peer / seen, median (max) ms | Shards at the end | Max connected at once | Max members in a room | Alone | Room joins per player per min | Relay frames/s (all 5 / busiest) | Busiest relay per hour | Not received | Update gap p99 (<150 m) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A crowd | 363 (440) / 366 | 2 (9,7), 3 rooms | 15 (over 8 for 104 s) | 14 for 14 s | 1 player 22 s | 0 | 25 / 7.3 | 26,000 frames, 12 MB | 0 % | 101 ms |
| D rolling | 334 (370) / 335 | 3 (8,7,1) | 10 (6 s) | 11 | none | 1 | 156 / 33.6 | 121,000 frames, 53 MB | 0 % | 101 ms (12 gaps over 250 ms, longest 684) |
| C wave | 665 (3044) / 674 | 3 (7,6,3) but 15 rooms | 15 (over 8 for 159 s) | 16 for 61 s | 2 players, 13 s | 23 | 4516 / 906 | 3.3 million frames, 1463 MB | 2.6 % | 267 ms (193 gaps over 1 s, longest 30 s) |
| E fast | 839 (2436) | no final state: pages stopped answering for 111 s | 6 | 15 | | 2 | 9597 / 1937 | 7.0 million frames, 3247 MB | | |
| B spread | 1389 (8727) / 1426 | no final state: pages stopped answering for 138 s | 14 | 14 | | 6 | 9380 / 1880 | 6.8 million frames, 3078 MB | | |

**N = 32** (2 game pages, 30 bots)

| | First peer / seen, median (max) ms | Shards at the end | Max connected at once | Max members in a room | Alone | Relay frames/s (all 5 / busiest) | Busiest relay per hour | Not received | Update gap p99 (<150 m) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A crowd | 344 (1034) / 347 | 5 (9,8,8,5,2) | 21 (over 8 for 25 s) | 17 for 17 s | none | 56 / 16.6 | 60,000 frames, 26 MB | 0 % | 101 ms |
| D rolling | 347 (448) / 348 | 6 (9,8,8,4,2,1) | 21 (over 8 for 108 s) | 19 for 29 s | 1 player 5 s | 241 / 54 | 195,000 frames, 85 MB | 1.1 % | 101 ms (27 gaps over 250 ms, longest 7 s) |
| C, E, B | not completed (pages stopped answering, one page crashed, watchdog; see the notes in the measurements file) | | | | | | | | |

**N = 64** (2 game pages, 62 bots)

| | First peer / seen, median (max) ms | Shards at the end | Max connected at once | Max members in a room | Alone | Relay frames/s (all 5 / busiest) | Busiest relay per hour | Not received | Update gap p99 (<150 m) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A crowd | 335 (638) / 336 | 9 (9,9,9,8,8,7,7,6,1) | 24 (over 8 for 124 s) | 17 for 23 s | 1 player 4 s | 156 / 53 | 191,000 frames, 84 MB | 0 % | 101 ms |
| D, C, E, B | not completed or not clean (D: the harness lost its pages for 134 s and 9 players never connected; the rest not run to the end) | | | | | | | | |

Join burst (all five relays, the first minute of A, everyone arriving within 20 s): 3,600 frames at 8 players, 49,000 at 16, 77,000 at 32, 108,000 at 64. The peak second at 64 players was 2233 frames out.

Frame time and CPU of the full game pages in these runs: 60 fps (16.7 ms mean, p99 16.8 ms) on desktop in A and D at every size up to 64 players, because the cap of 8 limits what is drawn. The Chrome of the 64 player run used 5.4 GB in all (about 1.8 GB of it the two game pages), about 28 MB per bot when loaded and about 42 MB in the mesh, and about 1.2 cores in renderers. One bot page costs about 4 to 5 ms of main thread a second at 8 peers.

### What it does today

**At 16 players in one spot.** Everybody connects in about 0.35 s, but nobody sees all 15: the crowd is cut into shards of at most 9 and a player only sees the members of its own shard plus whatever rooms fit under 8 in total (a room is all or nothing). End state 9 and 7 in the run in the table (an earlier run of the same scenario ended 8 and 8). Players 40 m apart in different shards do not see each other, and the shards do not merge later. Up to 15 connections were open at once in the first 20 s and 9 to 10 stayed open for the rest of the run (the connection cap is `MAXP + 2` for 10 s before a room is dropped, so "8" is a cap on what is drawn and sent, not on connections). The cap of 8 on shown players was never exceeded in any run (0 s).

**At 32.** Same pattern, 5 to 6 shards, up to 21 connections at once, one player alone for up to 5 s. Room signalling is fine (busiest relay 17 to 54 frames/s).

**At 64.** One spot works as well as 32: 9 shards (9,9,9,8,8,7,7,6,1), everybody connected within 0.64 s, a player in the last shard of 1 still saw 5 to 8 through visiting rooms, relay load 53 frames/s on the busiest relay. What did not work at 64 was a rolling join (the harness lost its pages), see below.

**Not in one spot (B, C, E).** This is the finding that matters. As soon as the players are not all in one room, the room choice does not settle at 8 players and above. In B with 8 players spread over the city (everyone can see everyone, 7 < 8) each player joined and left 35 rooms a minute and had 400 connection events a minute for as long as the test ran (110 s and 169 s), 3700 relay frames/s for 8 players, 3 % of position messages never arrived, and the update gaps for far players went to 2.7 s at p99. At 16 players the same situations (B, E, and C after the wave) went into a storm: relay traffic of 4500 to 9600 frames/s, the pages stopped answering for 100 s or more, one crashed. At 32 players all three situations did the same and were stopped. A wave of half the crowd leaving (C) also leaves rooms behind: after it, 8 players held 6 identical rooms of 8 for two minutes.

Cause, partly found (not proven): `evaluate()` in `src/p2p/p2p.js` adds `g.anon` (peers connected to a room beyond what presence lists for it) once per room into the count against `MAXP`. A peer that sits in several shared rooms is counted in each of them, so with presence lagging the count passes 8 and rooms are dropped and rejoined a second later, which publishes a new room list, which changes everybody else's count. Test: the same B run with 8 bots and `g.anon = 0` in the bots' copy of the file only (the `--patch` option of `stress.mjs`) went from 37 to 5.6 joins a minute, from 3744 to 349 relay frames/s. Less, not none: something else still keeps the rooms changing. This is a report, not a fix; nothing in `src/` was touched.

**Real relays.** The one run on them (4 players, the five pinned relays, private `?ns=`, 2 minutes): connected in 599 to 717 ms against 280 to 370 ms on the local relays at about the same size, no errors. That says nothing about 8 players or more in B on a real relay; the storm above is what an unthrottled relay does, a real one would rate-limit (the earlier measurement saw `rate-limited` replies at 1 event a minute from 2 pages) and the slower feedback might calm or sustain it. Not tested, and not testable within the rule of at most 4 players on public relays.

### Per hour, what the pinned relays would see

Steady crowd (A), the busiest relay, frames in plus out, extrapolated from the rates above: 8 players about 8,000 an hour, 16 about 26,000, 32 about 60,000, 64 about 190,000 (84 MB). The three relays that also carry presence take 3 to 4.5 times what the other two take, and about three quarters of their frames are presence events being passed to every subscriber, which grows with the square of the players online until the beat stretches (the beat is 60 s up to 96 players, then the number of players known divided by 1.6, at most 250 s because only 400 players are remembered). Estimate of that term: events out per presence relay per second = (2/3 N)^2 / beat (each player is on 2 of the 3 presence relays). At 64 players that gives 30 (measured 33 to 39 on the busy ones). At 1000 players the beat is 250 s and it gives about 1,800 events a second of 460 bytes, 0.8 MB/s, per presence relay. These are estimates from the code and the measurements at 64, not measurements at 1000. Add the join bursts (the first minute of A divided by N gives about 450, 3,000, 2,400 and 1,700 frames across the five relays per arriving player at 8, 16, 32 and 64) and any storm of the kind above, which dwarfs everything (a million frames an hour on the busiest relay at 8 players spread out, 7 million at 16).

### Headroom: raising `?maxp` with everyone in one room

M other players held, M + 1 players in one spot (1 game page, 2 bots on pages of their own, the rest bots), 60 s steady, desktop window 480x270. Bandwidth is the game page's WebRTC counters (data channel bytes; "wire" includes headers).

| M | Time to connect, median / p90 / max | Connected | Upload / download data channels | Wire up / down | Position messages per player per s | One-way delay p99 | Frame (mean, fps) | Game page main thread | Netcode alone, one bot page, normal / CPU x4 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 8 (shipped, from A) | 0.32 s | all | 7.9 / 8.0 KB/s | 12.5 / 12.6 KB/s | 71 | 1 ms | 16.7 ms, 60 | about 200 ms/s | 4 / not measured ms/s |
| 12 | 1.1 s / 2.0 / 2.8 | 12 of 12 | 13.6 / 13.7 KB/s | 21.3 / 21.5 KB/s | 121 | 6 ms | 16.9 ms, 59 (p99 33 ms) | 369 ms/s | 15 / 29 ms/s |
| 16 | 0.8 s / 1.7 / 1.7 | 16 of 16 | 17.9 / 18.2 KB/s | 28.2 / 28.5 KB/s | 162 | 6 ms | 16.7 ms, 60 | 499 ms/s | 21 / 40 ms/s |
| 24 | 1.4 s / 2.5 / 4.4 | 24 of 24 | 27.2 / 27.5 KB/s | 42.8 / 43.1 KB/s | 242 | 4 ms | 16.7 ms, 60 | 270 ms/s | 12 / 30 ms/s |
| 32 | 1.5 s / 85.8 / 89.4 | 31 of 32, one player never connected | 34.4 / 35.8 KB/s | 56.6 / 58.5 KB/s | 209 | 2171 ms (max 4953), 1755 gaps over 250 ms | 16.7 ms, 60 | 355 ms/s | 22 / 46 ms/s |
| 40 | run killed: pages stopped answering at 148 s | | | | | | | | |

Phone profile (844x390, CPU x4, game page): M = 16: 25.5 ms mean, 39 fps, p95 50 ms, p99 67 ms, main thread 847 ms/s, upload 14.1 KB/s (below the desktop 17.9 because the game loop sends fewer than 10 a second when it runs at 39 fps), download 18.2 KB/s, one-way p99 25 ms. M = 40 phone: killed like the desktop run. For comparison the older table: 8 peers on the phone profile 39 fps in that test too.

Where each limit bites first (measured here, on one machine):

1. Bandwidth per player grows by 1.1 KB/s up and 1.1 down per connected player in data channels, 1.8 each way on the wire: 28 KB/s each way at 16 (100 MB an hour each way), 57 KB/s at 32 (200 MB an hour). On Wi-Fi fine, on mobile data this is the first limit that matters; it is why 8 was chosen.
2. CPU of the netcode is not a limit: one bot page spent 12 to 22 ms of main thread a second at 24 to 32 peers, 46 ms a second at 32 peers with the CPU slowed 4x (under 5 % of a main thread). On the phone profile the frame time falls (39 fps at 16 peers) because of drawing the cars and tags, not the network. A cap on drawn players, not on connections, would help phones.
3. Mesh formation breaks first on the desktop: at 32 in one room the first connections were fast but the slowest took 85 to 89 s, one player of 33 never connected, one-way delays reached seconds (p99 2.2 s) and there were handshake timeouts and "could not connect after exchanging SDP" warnings. At 40 the pages stopped answering. Up to 24 everything was clean (delay p99 4 ms, no failures). This is on loopback with no NAT, so a real network will break earlier, not later.
4. Relays: room signalling per shard is small (a few frames a second). The relay cost comes from presence (squared in the players online up to 96) and from storms, not from the size of a room.

### Answers

**16, 32, 64 players today.** In one spot: everyone connects in about a third of a second, nobody sees more than 8, and the crowd splits into shards of up to 9 that do not merge, so at 16 you see 6 to 8 of 15 and cars 40 m away in the other shard are not there. Connections run at 9 to 10 sustained, 15 to 24 for the first 20 s. Relay load is small (a busiest relay of 7, 17 and 53 frames/s). Desktop stays at 60 fps. Spread out or driving fast over borders, it does not settle from 8 players up, and from 16 up it can storm. That is the main problem found.

**A cap we could run safely.** For a crowd in one room and desktop only: 12 to 24 measured clean here (60 fps, 14 to 27 KB/s each way, delay under 10 ms), but the shipped logic does not hold even 8 stably outside a crowd, so I would not raise the number before the churn is fixed. Phones should stay at 8 for bandwidth, and a cap on drawn cars is the better phone setting. Proposal, not a decision.

**1000 players, what breaks first.** (1) The room choice, as above, before any volume limit: it is unstable at 8 to 16 players away from each other, and a thousand players are nearly all away from each other. (2) Presence: `MAX_ENTRIES` is 400 and a new reader asks for at most 300 events, so beyond 400 online a client does not know the others; the doc already says it needs splitting by region. (3) The pinned relays: estimated 0.8 MB/s of presence per presence relay, about 1,700 open sockets each (1,000 Trystero and 667 presence), a count volunteer relays may not accept (unknown). (4) A storm on real relays would be more than they would take. Estimates, except where a figure is quoted from a run above.

**Cheapest change to push further.** In order of cost: (a) count each connected peer once in `evaluate()` (the `anon` double count; the test copy shows 7 to 10 times less churn); (b) after that, find what still keeps rooms changing, with `stress.mjs --scenario B --n 8` as the check (it must reach zero joins a minute); (c) leave a room only when all its members are in other held rooms (stops the ghost rooms after a wave); (d) merge two small shards of the same cell; (e) only then, a higher `MAX_PLAYERS` for desktop. Recommendations only.

What was not tested: real networks (NAT, mobile, loss, latency), Safari and iOS, more than 2 game pages at once, C, E and B at 32 and 64, rolling join at 64, the headroom at 40, repeat runs for variance (the shard sizes of a crowd differ from run to run: at 16 the same scenario ended 9,7 once and 8,8 another time).

### After the fix (4 Nov)

The tables above are the code before this fix. The room choice now lives in `src/p2p/rooms.js`, with a hard limit on top in `src/p2p/guard.js`. The wire format, the room names and the presence event are unchanged, so old and new clients still meet.

**Why it did not settle.** The partial cause found above was real but small. The main one: `evaluate()` remade the whole choice from scratch twice a second from a list that is up to 15 s old, and every choice changes what everybody else sees.

1. `g.anon` counted a connected peer once per room, so a peer in several rooms pushed the count over 8 and rooms were dropped and rejoined (the cause found above).
2. A room that brought nobody new was still wanted, so everybody joined everybody's rooms, up to 8 rooms each. Those were the 6 identical rooms of 8 after a wave, and each one costs the relays announcements and signalling.
3. Rooms were left because the list said so. A room looked too full, or gave way to another, on the strength of a list that was stale or already changing, and the leave changed the next list.
4. Nothing slowed a repeat: a room left could be rejoined as soon as the list said so.
5. Everybody joined everything they wanted in one pass, so all players overshot together on the same stale list.
6. The home room followed the car over every border, so fast driving was a new room join every 10 s.
7. A cell's shard counted 8 others as full, so a 9th player in one spot was sent to a shard of their own, and then visited the first as well.
8. Nothing helped a player left over: 9 in a room and 1 beside it stay that way, and nothing fits the one. A full room could also push out one of its own before its visitors had gone.

**What changed.** Joining goes by the list, leaving by the real connections ("The closest players", point 2). Joins are one at a time, at least 4 s apart, and a room must bring somebody new who fits. A room stays until it is no use, is clearly beaten, or there really are too many connections. A room left rests 30 s, doubling each time. A swap has to bring only players closer than those it gives up, and only players who would keep us, which is what ends the swapping: distance is the same from both ends, so each swap makes things better for both and they run out. The home room moves at most every 20 s (not for a teleport). Players do not visit other shards of their own cell. Shards that fit into one merge, and a full room gives a player left alone company.

**Before and after.** Same harness, seed and scenarios as above, local relays only (network check `LOCAL ONLY` in every run). **The Mac was shared and busy, and not equally:** the "before" runs had a load average of 16 to 147, part of it their own storms and part other agents, the "after" runs 4 to 8. So timings are not comparable, and "before" pages stopped answering for up to two minutes, which is why several of its figures are partial. Relay frames are counted by the relays themselves, so they hold either way. Joins per player per minute and relay frames per second (all 5 / busiest) are over the steady window (the last 60 s, or 45 s for C and D), except where a "before" run lost its samples, marked `*`: those windows stretched over the whole run, and their joins figure undercounts. Raw numbers: `docs/p2p/measurements.txt`, section "Room choice fix".

| Run | Before: joins/min | Before: frames/s | Before: what happened | After: joins/min | After: frames/s | After: what happened |
| --- | --- | --- | --- | --- | --- | --- |
| B, 8 spread | 40 | 4594 / 920 | never settled, 13 rooms, 482 connection events a minute, 1.4 % not received | **0** | **10.8 / 2.6** | last room change at 14 s of 137, 8 rooms (8,1,1,1,1,1,1,1), nothing lost |
| B, 16 spread | no figures | no figures | pages stopped answering, killed by the watchdog (earlier run: 9380 / 1880) | 0.94, falling | 168 / 37 | all seeing 5 to 8. Ran on for 8 minutes: last change at 334 s, then **0 joins, 33.6 / 8.2** |
| C, 8 wave | 0.54 * | 1522 / 308 * | pages stopped answering for 118 s | **0** | **9.9 / 2.5** | one room of 8 at the end, no ghost rooms |
| C, 16 wave | 2.07 * | 5705 / 1143 * | pages stopped answering for 111 s, 1 player alone 19 s | 0.17 | 75 / 16.5 | rooms 9,7,4; nobody alone. Up to 15 connected and a room of 14 while the wave came back |
| E, 8 fast | 4.07 * | 3779 / 760 * | pages stopped answering for 67 s | 1.5 | 73 / 16 | all see 7 throughout, nothing lost |
| E, 16 fast | 24.5 * | 7788 / 1563 * | pages stopped answering for 177 s, 2 never connected, 376 failed handshakes | 5.4 | 1169 / 238 | pages answer (longest gap between samples 2 s), 0.24 % not received, up to 15 connected, one player seeing only 2 at the end |
| A, 8 crowd | 0 | 8.5 / 2.1 | fine | 0 | 8.6 / 2.3 | the same |
| A, 16 crowd | 0 | 20.4 / 6 | 8,8; up to 15 connected for 12 s | 0 | 20.3 / 6.3 | 9,7; at most 8 connected, ever; nobody alone |
| A, 32 crowd | 0 | 53.9 / 20.6 | 9,9,8,6; up to 18 connected, a room of 19 | 0 | 53 / 18.9 | 9,9,9,5; at most 8 connected, room of 9 at most; first minute 16,295 frames (was 73,454) |
| D, 16 rolling | 0.67 | 219 / 46 | three rooms of 8, 19 failed handshakes | 0 | 23.7 / 7.1 | 9,7; at most 8 connected |

The game pages held 60 fps in every "after" run. The player alone for 22 s in A at 16 (finding 3) did not show up in this "before" run or in any "after" run, so that case on its own is not proven. The rules behind it are covered by `rooms-sim.mjs`, and A at 10 below shows the rule for a player left over.

A at 10 and C at 10 (after only) are the runs where 9 and 1 happen. A at 10: the last of the full room by id gave up its place, ending 8 and 2, last change at 30 s, 10.2 / 3.1 frames/s; the player left over waited 11 s for a first peer. C at 10: one player was alone for over 10 s (first peer after 18.9 s) until the same rule fired; 29.5 / 6.6 frames/s, 0.4 joins a minute at the end of the run, rooms 8,7,1.

**The safety limit** (`src/p2p/guard.js`, per player, a sliding minute):

| What | Limit a minute | Most used in normal runs | When reached |
| --- | --- | --- | --- |
| Room joins | 20 | 9 (B, C and E at 16) | no room joined for 1 minute, doubling to 16 minutes |
| Presence events | 16 | by design at most 8: 4 lists a minute on 2 relays, plus the beat | no event for 1 minute, doubling to 16 minutes |
| Frames on relay sockets, all of them | 2000 | 842 (E at 16) | the page stops: rooms left, sockets shut, presence off, for 2 minutes, doubling to 32 minutes |

A hit is forgotten after 30 calm minutes. Frames are counted inside `WebSocket.prototype.send` for the relay addresses, so nothing Trystero or presence does gets past it, including right after a reconnect. Only the Nostr relays are covered: the `?p2p=torrent` and `?p2p=mqtt` test modes count room joins only. Also fixed: presence retried a relay that accepts and drops a connection every 4 s for ever (the retry time now only starts over after 30 s connected). Other paths looked at for loops: a failed `joinRoom` (limited with the joins), a refused or rate-limited relay (already backs off), the solo state (the sockets are shut and stay shut).

Tried with a bug planted in the bots' copy (`stress.mjs --patch`, 8 bots, B, every room left twice a second): with the limits on, at most 20 joins and 572 frames per player in any minute and 95.9 frames/s across the relays over 5 minutes, against 4594 for the real bug of this section; nobody needed stopping. With the joins limit lifted that bug reaches 1587 frames a minute, which is under the frame limit, so to see the page stop the frame limit was set to 300 for one run: all 8 stopped at about 20 s, came back 2 minutes later, stopped again at about 151 s, came back 4 minutes later, stopped at about 402 s, and no player went over 300 frames in any minute. `guard-check.mjs` checks the arithmetic without a browser.

**Other checks.** `default.mjs`, `crowd.mjs`, `closest.mjs`, `feed.mjs` and `near.mjs` pass on local relays (`--local`). `near.mjs` needed two changes because of the fix: one shared far room is now enough (only one of the pair has to visit), and Anna leaves the spawn cell before Bob loads, or the two stay connected through that room. `rooms-sim.mjs` passes with 2 to 32 players, 5 seeds. One run on the real relays (4 players, `?ns=` private, the pinned five, 2 minutes): connected in 567 to 767 ms, last room change at 12 s, no errors, 35 relay frames in a player's busiest minute. Nothing else touched a public relay.

**Still not settled.**

- Everyone at 50 m/s (E at 16) goes on costing 1169 frames/s for as long as they drive, about 15 % of before. It is much the largest figure left. One room join there costs about 800 relay frames, in and out (1169 frames/s over 1.45 joins/s); from reading Trystero, that is 25 announcements (5 in the first seconds on each of 5 relays), passed on to everyone in the room, plus an offer and an answer on every relay for each new connection. Slower home moves and swaps took only about 20 % off in the simulator, so they were left alone. Fewer relays per room, or Trystero's `passive` rooms for a home nobody is in, should do more (proposals, not tried).
- More players than the cap, spread out (B at 16): it comes to rest, but takes about 5 minutes, and for the first minutes some players have up to 14 connections (only the closest 8 are sent to or drawn). A real city will not hold still for 5 minutes, so expect some swapping at all times, at the rates in the table and not worse.
- Connections are not capped at 8 outside a crowd: 9 or 10 stay open at rest (the rule is `MAXP + 2`), as before.
- Players in different shards 40 m apart still do not see each other. Not cheap to fix: a room is all or nothing. Merging helps only when the two shards fit into one.
- In the simulator a player can stay alone for up to about 100 s after a wave with 10 players, and 26 s in a crowd of 19 (bans of 2 minutes hold them out of the full room for that long). Not seen in a real run.

**Raising the cap.** Measured with `?maxp=12` at 16 players (1 game page, 15 bots, same harness, load average 3 to 5):

| | Joins/min | Relay frames/s (all 5 / busiest) | Most in any minute, one player | End |
| --- | --- | --- | --- | --- |
| A crowd | 0 | 24.9 / 6.9 | 1 join, 190 frames | rooms 13,3; the 3 see only 2 |
| B spread | 1.81 | 442 / 91 | 10 joins, 649 frames | still moving at the end of the 137 s, all see 7 to 12 |
| E fast | 3.94 | 1219 / 247 | 8 joins, 754 frames | 1.54 % not received, up to 15 connected |

Same order as the cap of 8, no limit hit, 60 fps on the game page. So the fix removes the reason given above for not raising it, on one machine. It is still not safe to make it the default on this evidence: a cap of 12 was not run at 32 or 64 players, not run long enough to see B at rest, and nothing here shows NAT, mobile networks or real relay rate limits. My recommendation: the real test below at 8 first, then 12 for desktop only. Phones stay at 8 for bandwidth (the headroom table above), and the guard's limits should be looked at again if the cap goes up.

**What a real-world test should check** (8 to 16 people, different networks, at least two phones, on the real relays, the owner's call):

1. The debug box (`?p2p`): `rooms` should stop changing within a minute or two when nobody moves and there are no more than 9 players; a page's room joins (`__p2p.stats.joins`) should stay still at rest.
2. `__p2p.stats.limits` and `halts` should stay 0 for everybody, and `__p2p.stats.relayTx` should stay far from 2000 a minute. A hit in normal play means a limit is too low, and a player has lost their connections for at least a minute.
3. Relay replies: `__p2p.presence.stats.refused` and `limited`, and whether Trystero logs `rate-limited` (a real relay may slow joins enough to change the timing).
4. Time to see each other, spread over the city: visits are now 4 to 6 s apart, so the 7th player can take up to about 40 s by the arithmetic, if nobody comes the other way (in B at 8 here the rooms had stopped changing at 14 s).
5. A pair stays connected through driving, a pause in the Garage and a phone locked for a minute. A player silent for 30 s loses the visitors who came for them alone, and is rejoined when back (30 s rest at least).
6. Old tabs: a client opened before this release has none of this until it is reloaded. The storm risk from those lasts as long as they stay open.

## Privacy

Players see each other's IP addresses (since 4 Nov the closest `MAX_PLAYERS`, wherever they are: see "The closest players", which lists exactly who learns what). A WebRTC connection hands your public IP (and, if the browser does not hide it, local addresses) to the other side, and it does so to everybody you share a room with, which may be strangers. The signalling servers (Nostr relays, trackers or brokers) and the STUN servers (Cloudflare's, among Trystero's defaults) also see your IP. Room names are hashed, but anyone can compute the hash of each cell, so the signalling service can tell which 500 m cell your IP is in. Peers learn your name, livery, exact position and speed.

Design consequences: nothing connects without the player's yes (multiplayer is on by default, but the name card comes first, see On by default), say so before the first connection, no sending of anything beyond what is in the wire format, no persistent id (the peer id is random per page load; the multiplayer code itself stores nothing). The separate play log (`src/playlog.js`, `joinlog/README.md`) does save things once `src/playlog-url.js` is set: every player, solo or online, sends anonymous counts about play and performance (no name, no address, no lasting id, off in Options > Game stats), online players' chosen name goes with them, all kept up to 12 months. The name card's "i" says so in that case and keeps saying "Non salviamo nulla" / "We store nothing" while the address is empty, so the claim is true at every moment. A notice would need to say: other players near you can see your IP address; so can the signalling services we use, which also learn the 500 m area you are in; names and positions are public to players nearby; list the third parties by name (the Nostr relays or trackers we pin, and the STUN server); we cannot delete data held by them; players can play without it. I am not a lawyer; if the audience includes children or the EU, check the wording.

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

1. `connect-src` must allow the signalling WebSocket servers. The base is `'self'`. The `--p2p` build adds a bare `wss:` so any server works while testing. For a release, pin Trystero to a short list (`relays=` / `relayConfig.urls`) and list exactly those hosts, for example `connect-src ... wss://relay-one.example wss://relay-two.example`. Leaving the default list would mean about 29 Nostr hosts that rotate with the library version.
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

## The talk wheel

The multiplayer section (`src/p2p/panel.js`, the HUD zone `social` bottom left, above the steering pads on a touch screen) shows only while the player is online. It is one dark capsule that says how many players are connected and how many of them are within 400 m (`DRAW_R`, the range at which another player is drawn as a car), with the talk button; above it stand the last three things said, each as `name dici “phrase”` (`name said “phrase”` in English), fading after seven seconds. Your own phrase appears the same way. Names are other players' text: they are set with `textContent` only, and a long one is cut with an ellipsis so the words stay. A phrase is sent only to players within 400 m of the sender, and a receiver farther than that ignores it (no bubble, no line, no sound), so a player who is only a ring on the map never hears it; the wire format is unchanged. Test: `tools/p2p/feed.mjs`. The talk button (or the T key) opens a radial menu in the middle of the screen. The first ring is five categories (Saluti, Complimenti, Brindisi e da bere, In strada, Sfottò); a category swaps the ring for its phrases, the middle circle goes back, and from the first ring it closes. Keys 1 to 8 pick, Backspace goes back, Escape closes (without opening the pause menu). It has no full-screen backdrop, so the touch driving controls keep working while it is open, and it closes by itself when the game pauses. The two real drink offers sit in "Brindisi e da bere". The grouping lives in `CATEGORIES` in `src/p2p/phrases.js` as indexes into `PHRASES`, so moving a phrase to another category is a one-number edit; `tools/p2p/phrases-check.mjs` checks every phrase is in exactly one category and none has more than 8 entries. Test: `tools/p2p/wheel.mjs`. The category names and the grouping are a first guess for the owner to rearrange.

## On by default

Multiplayer is on by default on the published site. Nothing connects until the player has seen the name card and chosen Gioca online. The card sits in the middle of the screen over a full-screen dim layer that takes every touch. What other players can see, and what we keep, is behind the card's i button, which replaces the form with three short paragraphs (`KEPT`, `STATS` and `WHO_SEES` in `src/p2p/p2p.js`; `STATS` follows `PLAYLOG_ON`, and `WHO_SEES` is the one place to change when who can see a player changes). The card asks on every page open, with a saved name filled in: only the name is remembered, never the answer. Gioca da solo stays solo until the next page open, or until the player opens the card again from Options. The multiplayer section only shows while the player is online, and the wheel only opens when somebody is within 400 m.

`?p2p=off` turns the client off. `?p2p` in the address is the test mode: the debug box shows and a name is enough to join. Add `&ns=<anything>` to keep a test group's rooms apart from everyone else's. The comparison shots and benches (`?clean`, `?fixres`) never show the card and never join. `tools/p2p/default.mjs` tests this flow on a built site.

## Drink offers, review (3 Nov)

OFFER [4][kind][id], ACCEPT [5][0][id], CONFIRM [6][kind][id] and now REPLY [7][code][id]: 0 no, 1 busy (paused, game over, another card up), 2 had enough (the stack of src/drunk.js is full), 3 you are too far from me (all receiver to giver); 4 cannot pay, 5 you walked off (giver to receiver, after the yes). Every outcome shows a line on the screen of the player it concerns (the game's toast line), the giver has a waiting line until the answer, the receiver's card names the giver, the drink and how dizzy it makes them (the stack after this drink, 1 to 6). A card closes by itself when the giver leaves or drives off or the game pauses; a player who said no (or let the card run out) gets no card from that giver for a minute. The receiver is dizzy through `drunk.gift` exactly as at a pub. Tests: `tools/p2p/offer.mjs` (every outcome, two isolated browser contexts), `interact.mjs` (desktop and `--phone on`), `states.mjs` (solo and back, drowning).

Trystero cannot close the relay sockets after "Gioca da solo": `getRelaySockets()` hands out the raw WebSockets only, the client objects that own them sit in a module level registry, and closing a raw socket makes Trystero reopen it within seconds (tested). A player who is solo from the start never opens them.

## Round two (3 Nov)

- **Going solo closes the relay sockets.** `@trystero-p2p/nostr` 0.26.0 already exports `pauseRelayReconnection` and `resumeRelayReconnection` (one lock in core, shared with BitTorrent). `tools/build/vendor-trystero.mjs` re-exports them (+59 bytes in `src/p2p/trystero.js`), joins pass `relayConfig.manualReconnection: true` and `src/p2p/p2p.js` follows the browser's offline and online events itself, except that online does not resume while the player is solo. "Gioca da solo": leave the rooms, pause, close the sockets (again every 2 s, in case a relay was already waiting to retry). "Gioca online": resume. Measured in `tools/p2p/states.mjs`: 5 open before, 0 for 30 s after, 5 again and the players meet.
- **Free rounds.** Two drinks are free for every browser (key `palermoDrive.p2pFree.v1`, counted down when a drink is paid for, not refilled by a reload; no storage means none). The giver's line says it was free and how many are left.
- **Height in the state.** STATE flag bit 3 means a u16 follows: `car.lift` in tenths of a metre (the height above `groundY` at x, z: air, bridge deck, roof), sent above 0.6 m only. The receiver rejects anything over 1000 m (the ceiling is 700), interpolates it with x and z and draws at `groundY + height`. Tests: `fly.mjs`, `fuzz.mjs`.
- **Arrivals, sound, keys.** "X è vicino" at 60 m (again after 100 m), once a minute per player and once every 6 s overall; a two note blip for a phrase and three for an offer at the game's volume (`game.settings.volume`); Y and N answer the card (shown to keyboard players only, N is the radio's key and the card has it first). `hello.mjs`.
- **Maps.** Other players are a cyan ring (`#00e1ff`, a shape and a colour nothing else on the maps uses) on the minimap, named for the nearest one when the map is 150 px or wider (not on a phone, where it is 98 px), and on the big map with their names. Only players we are connected to exist (the closest `MAX_PLAYERS`, anywhere in the city; far ones are a ring and a name, see "The closest players"); there is no list of everybody. `maps.mjs`.
- **Missions.** An offer to a player in a timed mission (`missions.busy()`, except the pub errand, the leaves and the rave) is held: REPLY 6 tells the giver, the card shows 3 s after the mission ends if the giver is still near and the offer stands, and after `HOLD_MS` (120 s) the giver is told the player is busy. `held.mjs`.
