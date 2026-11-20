# Online multiplayer

Every player holds one WebSocket to the game's relay (`relay-worker/`, a Cloudflare Worker with one Durable Object), sends its own car, and receives the players near it. Nothing else: no WebRTC, no Nostr, no TURN, no list of who is online on a public service. Players never learn each other's address.

Until 20 November 2026 this was peer to peer (Trystero over Nostr relays, WebRTC data channels, TURN). What that design measured and why it was dropped is in the git history (`git log -- docs/P2P-MULTIPLAYER.md`); what still applies from it is kept below.

## Files

| File | What it is |
| --- | --- |
| `src/online/online.js` | The client: name card and consent, players by handle, sending, drink offers, phrases, the panel and the debug box. `createOnline(env)`, called from `src/main.js`. |
| `src/online/wire.js` | The frames, packed and read. No DOM and no socket: every byte from the relay is checked here. |
| `src/online/link.js` | The one WebSocket and its reconnecting (backoff with jitter). Knows nothing about the game. |
| `src/online/status.js` | Why there is nobody (relay full, over for today, cannot be reached): asking `/status`, the local time of 00:00 UTC, and every line the player is told, in both languages. |
| `src/online/relay-url.js` | The address of the relay, in one place. Empty means the game never connects. |
| `src/online/panel.js`, `wheel.js`, `phrases.js` | The multiplayer section on the street, the talk wheel, the fixed list of phrases. |
| `src/remotes.js`, `src/predict.js` | Other players' cars (smoothing, the jitter buffer) and the prediction shared by sender and receiver. |
| `tools/online/` | The tests, and `relaysim.mjs`, a relay simulator for them (test tooling, not the relay). |

`window.__p2p` and `?p2p` keep the names the test tools have always used: `?p2p` shows the debug box and lets a name be enough to join, on a page served from localhost or 127.0.0.1 only (on any other host the name card still asks, so a link cannot put anybody online); `?p2p=off` leaves online play out altogether.

## Protocol v2

All frames are binary, little endian, the first byte is the type, at most 96 bytes. The relay's own README (`relay-worker/README.md`) is the reference for what it does; this is what the client relies on.

| To the relay | Layout |
| --- | --- |
| 1 HELLO | `[1][2][info]` once, first |
| 2 INFO | `[2][info]` the name, vehicle or livery changed (at most one every 2 s) |
| 3 STATE | `[3][state]` the car; also the keepalive |
| 4 SAY | `[4][phrase u8]` an index into `src/online/phrases.js` |
| 5 TO | `[5][handle u16][direct 1..8 bytes]` a drink offer or its answer |

| From the relay | Layout |
| --- | --- |
| 1 WELCOME | `[1][2][handle u16][online u16]` the answer to HELLO |
| 2 ENTER | `[2][handle u16][info]` this player is now one of yours, or changed its info (a repeat is an info update) |
| 3 LEAVE | `[3][handle u16]` no longer one of yours |
| 4 STATE | `[4][handle u16][state]` |
| 5 SAY | `[5][handle u16][phrase u8]` |
| 6 TO | `[6][from handle u16][direct]` |
| 7 ONLINE | `[7][online u16]` the number connected changed |

`info` is `[vehicle u8][livery u8][nameLen u8][name utf8]` (at most 16 characters, 64 bytes). `state` is `[time u16][position 5][heading u16][speed i16][steer i8][roll i8][lean i8][flags u8][curvature i16][accel i8][height u16]?`: 18 bytes, 20 with a height. Time is the sender's clock in ms mod 65536, so the receiver knows when each state was true and how late it came; position is x and z in 1/20 m, 20 bits each; speed is in 1/100 m/s; flags are bit 0 nitro, 1 brake, 2 drift, 3 height follows (the other bits must be 0); curvature of the path in 1/10000 per metre; acceleration in 1/10 m/s2; height in tenths of a metre above the ground at x, z (a bridge deck, a roof, the air), sent only above 0.6 m. A drink's messages are the direct bytes `OFFER [4][kind][id]`, `ACCEPT [5][0][id]`, `CONFIRM [6][kind][id]`, `REPLY [7][code][id]`.

The relay gives each player a set of the nearest other players (8 in `relay-worker/`) and says when it changes; a player who enters the set arrives with its latest state, so it is drawn at once. A STATE reaches only the players who have the sender in their set, thinned by the distance between the two: always under 150 m, else at most one per 200 ms under 350 m, per 1 s under 1200 m, per 2.5 s farther. A SAY reaches those within 400 m. A TO reaches the target only if the target has the sender in its set.

## Connecting

Nothing connects until the player has a name and has said yes on the name card ("Gioca online", or Online in Options). The card asks on every page open; only the name is remembered. "Gioca da solo" closes the socket and keeps it closed.

The socket is open while the player is online and the game has been played in the last 30 s. A game paused or left in the Garage for longer, or a page in the background, lets go of the relay (it closes a silent socket after 60 s anyway), and the next frame back reopens it. When the socket drops, every other player is forgotten at once (the cars go), then the page asks again after 1 s, 2 s, 4 s and so on up to 10 minutes, each wait cut at random to between half and all of its step, so a thousand pages that lost the relay together do not come back together. A connection that stayed up 15 s starts the waits again from 1 s; one that dropped at once does not. The browser's own "online" event tries again at once. A relay that cannot be reached, is full (503) or is over its daily allowance all look the same to the socket, so after each failed step the page asks the relay why (next section); the game goes on whatever the answer, and no technical error is ever shown. `tools/online/link-check.mjs` and `relaydown.mjs` test the waiting.

## When online is not available

The relay is on Cloudflare's free plan, which has daily limits shared by every player, so "online is not there" is a normal thing that has to be said plainly. The states are told apart at a glance (code: `src/online/status.js`, shown by `online.js` and `panel.js`):

| State | Pill (colour) | When |
| --- | --- | --- |
| connected | players count (cyan ring), talk button | as always |
| connecting | `Online…` (grey dotted ring) | before the first answer and while asking again; says nothing else |
| full | `Online chinu` (amber) | `/status` says `full`, or the relay closed us with 1013 |
| over for today | `Online finutu pi oggi` (red) | `/status` says `quota` (the object's free daily limit is used up), or `budget` / close 1008 "daily allowance used" (only this address's share is used; its own sentence) |
| cannot be reached | `Online un funziona` (violet) | the socket will not open and `/status` cannot be read or says `error`: no reason is claimed |

The pill is the capsule of the multiplayer section (there while driving online); above it the panel shows one or two sentences, the same sentence comes once as a toast (6.5 s) when the state changes, and "L’online tuinnàu!" once when it recovers. "Over for today" says when it comes back: 00:00 UTC on the player's own clock (01:00 in Italy in winter, 02:00 in summer, from the browser's time zone). The name card says before the choice that online runs on a free server with a daily limit. All the words are at the top of `src/online/status.js`, one constant per line (the Palermitan ones are the owner's drafts).

### How the reason is known

A browser cannot read the status or body of a failed WebSocket upgrade, so there is a side channel: `GET /status` on the relay's Worker (CORS for the game's origins and localhost / 127.0.0.1 with a port, `Cache-Control: private, max-age=5`, always 200 JSON). It answers `{"ok":true,"online":n,"max":m}`, `{"ok":false,"why":"full"}`, `"budget"` (this address's frames for today are used), `"quota"` (the call to the object failed with a message that names an exceeded limit) or `"error"` (it failed for any other reason). What Cloudflare documents:

- Worker over its own daily limit (free plan, 100,000 requests a day, resets at 00:00 UTC): "Cloudflare returns Error 1027" for a route that fails closed, an error page from Cloudflare, not from our code ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/); the [Workers errors](https://developers.cloudflare.com/workers/observability/errors/) page lists 1027 as "Worker exceeded free tier daily request limit"). The docs do not state the HTTP status. Such a response carries no CORS headers, so the browser fails the `fetch` or shows it as opaque: the page cannot tell it from a relay that is simply down, and says "not available right now" without a reason. (Fail open, the other mode, bypasses the Worker, which is no use to a relay.)
- Durable Object over its free limits (100,000 requests a day, 13,000 GB-s a day, plus SQLite rows; incoming WebSocket messages count 20 to 1; reset 00:00 UTC): "further operations of that type will fail with an error" ([Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)). The docs give no message text and no status for the stub's `fetch`. Users report messages such as "Exceeded allowed volume of requests in Durable Objects free tier" (found through search results, the Cloudflare community threads themselves could not be opened from here), and some say the errors outlast the reset by a few minutes. So the Worker catches whatever the stub throws and calls it `quota` when the text speaks of exceeding something or of the free tier, `error` otherwise (`relay-worker/src/status.rs`, unit tested). This is a best guess at the wording, not a documented contract: if the text differs, the player is told "not available right now" instead of "finished for today", which is still true.

The cost is kept near nothing: the page asks `/status` only after a socket has failed (once per backoff step, one request at a time), never while connected; a daily reason (`quota`, `budget`) is not asked again for 15 minutes; a close code the relay sent itself (1013, or 1008 with "daily allowance used") gives its reason with no request. The page's content security policy names the relay for both `wss:` and `https:` (`connect-src`, `tools/build/build.mjs`), so the `fetch` is allowed. `tools/online/states.mjs` walks all of it; `relaysim.mjs` has `/status` and `set({ status, maxConns, frameDay })` to produce each state.

## What the client sends, and when

Only while the game is being played, as a STATE frame, the same rule as the peer to peer client's fast channel: a state goes when the car is no longer where `predict()` (`src/predict.js`) puts it from the last state sent (a turn, braking, a weave), and at least every second moving or every two seconds parked. Sender and receiver run the same `predict()`, and the receiver draws the car a little behind its latest state, carried on by the prediction, so sending less often adds no lag. Close by, a state goes when the car is more than 0.2 m, 2 degrees or 0.5 m/s off the prediction, or the steer, roll, lean, flags or height change; farther out the tolerances grow with the distance over 50 m.

What changed is who the pace is for. The relay thins each state by the distance to each receiver, so what a state needs is set by its nearest receiver. The client knows only its own set, not who has it in theirs, and uses the nearest player of its own set: anybody not in the set is farther than everybody in it (when the set is full), so the nearest one of ours has the highest need of anybody who gets us. A player whose position has not arrived yet counts as close. With nobody at all the far pace (one state every 2.5 s) keeps the relay knowing where we are, so that a player who arrives near us finds us, and when somebody enters the set one state goes at once. This costs a little more than needed when the nearest player of our set does not have us in its set, and never less than anybody needs.

INFO goes when the name, vehicle or livery changes, at most every 2.2 s. SAY and TO go when the player talks or makes an offer.

## What the client does with what it receives

Everything the relay sends is bytes made by strangers. `parseFrame()` (`src/online/wire.js`) returns null for a frame that is not exactly right: unknown type, wrong length, handle 0, a name field that lies or is over 64 bytes, a phrase index we do not have, reserved flag bits, a height over 1000 m, a position beyond 20 km. After that:

- Nothing but WELCOME is accepted before WELCOME, a second WELCOME is bad, and an ENTER with our own handle is bad.
- The table of players is capped at 16 (the relay sends 8; the rest is room for an ENTER that comes before the LEAVE that makes space), and at most 8 are drawn, the nearest. A frame for a handle that was not introduced is dropped.
- Every player has a token bucket (burst 60, 40 a second), the relay as a whole has one (burst 800, 400 a second), a phrase from one player must be 1.2 s after the last, an offer 8 s, and a new name for a player in under about 1 s is dropped.
- Names are cleaned to plain text (control, zero width, direction override and line separator characters removed, whitespace collapsed, 16 characters) and drawn on a canvas. They are never put into the page as HTML.
- A phrase is an index into a fixed list; a receiver more than 400 m from the sender ignores it.
- The drink offer needs the receiver's own click; the receiver drinks only after a CONFIRM that matches an offer they accepted; the giver pays on accept. Two rounds are free for every browser.
- A state older than the last one or a copy of it is dropped (the receiver keeps the sender's clock). A car that has not been heard from for 6 s is taken off the street, and a player not heard from for 90 s is forgotten.
- The handler never throws: a frame goes through a `try` that counts what it catches (`stats.threw`), and the tests require that count to be 0.

`tools/online/fuzz.mjs` feeds hostile frames through the real handlers, with cases for every frame type, the frame as a whole, a flood and more players than the table holds.

## Privacy

The players the relay sends you see your name, position, vehicle, livery and what you say, not your address. Our relay, on Cloudflare, sees every online player's address in passing, as any server does, and stores none. The name card says so in both languages (`WHO_SEES` in `src/online/online.js`: the one place to change when who can see what changes). Anonymous play statistics (`src/playlog.js`, `joinlog/README.md`) are separate: every player, solo or online, sends counts, and an online player's name goes with them only when `src/playlog-url.js` has an address and the player said yes.

The page's Content-Security-Policy allows one host for the game: the origin of `RELAY_URL`. `?relay=<ws or wss address>` points a test at another relay and is honoured only when the page itself is served from `localhost` or `127.0.0.1`.

## The talk wheel, drink offers, the rest of what the player gets

- **Wheel.** The talk button of the multiplayer section (`src/online/panel.js`, the HUD zone `social` bottom left) or T opens it; categories first, then the phrases of one (keys 1 to 8, Escape closes, Backspace goes back). It is built from `src/online/phrases.js`, so what it can send is exactly what a receiver accepts; the drink wedges make an offer. It opens only when somebody is within 400 m (`DRAW_R`). The panel shows only while online; it says how many are connected and how many are within 400 m, and above it stand the last three things said, as `name rici “phrase”` (`name said` in English).
- **Offers.** The nearest player within 25 m gets an OFFER and a card (Accetta / Nun mi va, keys Y and N). Every outcome gives a line to the player it concerns: REPLY codes 0 no, 1 busy, 2 had enough, 3 too far, 4 cannot pay, 5 walked off, 6 on a mission. One card at a time, 10 s between offers, a player who said no is not shown another card from that giver for a minute. An offer to a player in a timed mission (`missions.busy()`, except the pub errand, the leaves and the rave) is held: the card shows 3 s after the mission ends, or the giver is told the player is busy after 120 s.
- **Arrivals.** "X è vicino" at 60 m (again after 100 m), once a minute per player and once every 6 s overall; a small sound for a phrase and for an offer at the game's volume.
- **Maps.** Other players are a cyan ring with a name on the minimap and the big map: the players of the set, wherever they are in the city. Beyond 400 m a player is a ring and a name and no car.
- **Phone.** The most that is drawn is 8, chosen from phone-profile measurements made for the peer to peer client (844x390, device scale 3, CPU slowed 4x): frame time was inside the noise up to 12 other players and 16 cost about 2 ms and 5 fps; 8 kept the worst case below 15 KB/s each way. The measurement was of cars drawn, which has not changed.

## Measurements

`tools/online/bytes.mjs`: one Mac, two or eight real game pages and one relay process (the simulator, `tools/online/relaysim.mjs`) on the same machine, so the network leg is about nothing and the lag is the draw buffer and the prediction. The car's pose is held by the test so the physics cannot stop it at a wall. The drive: a 160 x 100 m loop, 16 m/s on the straights with a 0.3 m weave, braking at 5 m/s2 to 9 m/s for 25 m corners.

Per player per second, application bytes (WebSocket payloads) and frames; "with framing" adds the WebSocket headers (6 bytes up, 2 down per frame) and nothing below (TCP, TLS):

| Scenario | Up frames | Up bytes | Up, with framing | Down frames | Down bytes | Down, with framing |
| --- | --- | --- | --- | --- | --- | --- |
| Two players, both parked | 0.5 | 10 | 13 | 0.5 | 11 | 12 |
| Two players, one drives | 2.37 | 45 | 59 | 2.37 | 50 | 54 |
| Two players, both drive | 4.73 | 90 | 118 | 4.73 | 99 | 109 |
| Crowd of 8, all parked | 0.5 | 9 | 12 | 3.47 | 73 | 80 |
| Crowd of 8, 4 drive, 4 parked | 2.74 | 52 | 69 | 18.41 | 387 | 423 |

Frames up are what the relay's free plan counts (20 incoming messages to one request, 2 million incoming messages a day). A crowd of 8 with half driving receives 18 frames a second per player (outgoing messages are free). One player driving all the time sends 2.4 to 4.7 frames a second, 0.2 to 0.4 million a day if they drove for 24 hours; the rule of one state a second or two while parked is what keeps a parked page cheap. For comparison, the peer to peer client cost 2.3 KB/s each way per pair through TURN whatever it did, and 0.25 to 0.5 KB/s after the prediction rule (docs of 7 Nov); the figures above are per player and do not include the room signalling, presence and ICE checks that design needed on top.

Lag, from the moment the sender's car is at a pose to the frame the receiver draws it there, p50 / p95 in ms, one player drives and the other watches (Anna drives, Bob parked) and both drive:

| Phase | One drives: all | steady | just after a turn starts | just after braking | Both drive: all |
| --- | --- | --- | --- | --- | --- |
| p50 / p95 | 58 / 104 | 56 / 61 | 92 / 106 | 52 / 56 | 60 / 95 |

The car drawn is off the true path by 0.03 m at p50 and 0.15 m at p95 (one drives; 0.12 m both drive, largest 0.3 m), the drawn speed over the true speed is 0.94 / 0.97 / 1.63 at p1 / p5 / p99, and the largest step in one frame is 0.29 m (at 16 m/s a frame is 0.27 m). These are the same as the peer to peer client's on a clean link: the state, the prediction and the buffer did not change, only the road they travel.

What this does not measure: a real network. A relay in Frankfurt or wherever the object is placed adds a round trip each way for every pair (the relay forwards, the players do not talk directly), tens of milliseconds from Italy; the buffer follows the network's jitter, so that cost shows as lag and not as stutter. TCP head of line blocking replaces packet loss: a lost segment holds later states back, where the old unreliable data channel dropped them. Neither was measured.

## Tests

Build the page with `node tools/build/build.mjs --test-relay --out <dist>` (the page policy then also allows a relay on this machine; the published build never does), and run browser tests through `tools/release/withbrowser.sh node tools/online/<tool>.mjs --root <dist>`. Each prints OK / FAIL lines and exits non-zero on a failure. A test starts its own relay simulator, or uses `--relay ws://127.0.0.1:8799/r` (`wrangler dev` of `relay-worker/`, see its README). The tools refuse any relay that is not on this machine.

| Tool | What it checks |
| --- | --- |
| `smoke.mjs` | two players see each other drive, names, vehicles and liveries arrive |
| `cap.mjs` | more players than the cap: the nearest are drawn, a far one that drives up replaces the farthest, a leaver is gone |
| `switch.mjs` | solo and online switching (card and Options), no connection while solo, drowning |
| `relaydown.mjs` | the relay goes away and comes back, is full (503), the browser says the network is back |
| `wheel.mjs`, `hello.mjs`, `offer.mjs`, `held.mjs` | the wheel and phrases, "X è vicino" and the sounds, every outcome of a drink offer, offers held during a mission |
| `maps.mjs` | the rings on the minimap and the big map, desktop and phone |
| `fuzz.mjs` | hostile frames of every type |
| `bytes.mjs` | the tables above (`--scenario pair` or `crowd`) |
| `states.mjs` | every state of the section above on a desktop and a phone page: pill words and colour, panel, toast, local time, solo driving, request count; screenshots to `~/.cache/palermo-drive/online-states/` |
| `link-check.mjs` | reconnecting, with a fake socket and clock; no browser |
| `relay-rules.mjs` | the relay's rules from outside, with bots; no browser; run it against any relay |

## Not done

- Not measured over a real network, through Cloudflare, from a phone, in Firefox or Safari.
- A relay that lies is only checked frame by frame: valid frames that say false things are believed (see `docs/SECURITY.md`).
- `src/online/relay-url.js` names the deployed relay; the game on `main` is not released with it yet.
- The relay's daily allowance is shared by everybody. A client that cannot get in asks again at most every ten minutes, but nothing stops a script from asking more often; that is the relay's per address limit's job, and it cannot do it completely: Cloudflare bills an incoming request or frame before the relay's code runs, so no rule in the relay can stop a script from spending the allowance (see the online multiplayer review in `docs/SECURITY.md`).
