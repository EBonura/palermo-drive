# Online multiplayer

Every player holds one WebSocket to the game's relay (`relay-worker/`, a Cloudflare Worker with one Durable Object), sends its own car, and receives the players within 400 m (the nearest 32 of them; 8 anywhere for a page from before protocol 3). Nothing else: no WebRTC, no Nostr, no TURN, no list of who is online on a public service. Players never learn each other's address.

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

`window.__p2p` and `?p2p` keep the names the test tools have always used: `?k=N` (the players to receive, at most 64) and `?shown=N` (the cars drawn) change the two numbers above, on a page served from localhost or 127.0.0.1 only. `?p2p` shows the debug box and lets a name be enough to join, on a page served from localhost or 127.0.0.1 only (on any other host the name card still asks, so a link cannot put anybody online); `?p2p=off` leaves online play out altogether.

## Protocol v3 (and v2)

All frames are binary, little endian, the first byte is the type, at most 96 bytes. The relay's own README (`relay-worker/README.md`) is the reference for what it does; this is what the client relies on.

| To the relay | Layout |
| --- | --- |
| 1 HELLO | `[1][3][want u8][info]` once, first. `want` is the number of players to receive (0: the relay's 32, at most 64). A page from before protocol 3 sent `[1][2][info]` and is still served exactly as it was |
| 2 INFO | `[2][info]` the name, vehicle or livery changed (at most one every 2 s) |
| 3 STATE | `[3][state]` the car; also the keepalive (every 1 s moving and 4 s still while somebody holds us, 4 s moving and 15 s still while nobody does) |
| 4 SAY | `[4][phrase u8]` an index into `src/online/phrases.js` |
| 5 TO | `[5][handle u16][direct 1..8 bytes]` a drink offer or its answer |

| From the relay | Layout |
| --- | --- |
| 1 WELCOME | `[1][3][handle u16][online u16][set size u8]` the answer to HELLO (`[1][2][handle][online]` from a relay of protocol 2) |
| 2 ENTER | `[2][handle u16][info]` this player is now one of yours, or changed its info (a repeat is an info update) |
| 3 LEAVE | `[3][handle u16]` no longer one of yours |
| 4 STATE | `[4][handle u16][state]` |
| 5 SAY | `[5][handle u16][phrase u8]` |
| 6 TO | `[6][from handle u16][direct]` |
| 7 ONLINE | `[7][online u16]` the number connected changed |
| 8 BATCH | `[8][n u8][handle u16][state] x n` 2 to 16 states the relay held for up to 40 ms to send together, each exactly a STATE frame of that handle; at most 354 bytes |
| 9 AUDIENCE | `[9][band u8]` how far the nearest player that holds us is: 0 nobody, 1 to 8 for under 50, 100, 150, 250, 350, 600, 1200 m and beyond; sent only when it changes band |

`info` is `[vehicle u8][livery u8][nameLen u8][name utf8]` (at most 16 characters, 64 bytes). `state` is `[time u16][position 5][heading u16][speed i16][steer i8][roll i8][lean i8][flags u8][curvature i16][accel i8][height u16]?`: 18 bytes, 20 with a height. Time is the sender's clock in ms mod 65536, so the receiver knows when each state was true and how late it came; position is x and z in 1/20 m, 20 bits each; speed is in 1/100 m/s; flags are bit 0 nitro, 1 brake, 2 drift, 3 height follows (the other bits must be 0); curvature of the path in 1/10000 per metre; acceleration in 1/10 m/s2; height in tenths of a metre above the ground at x, z (a bridge deck, a roof, the air), sent only above 0.6 m. A drink's messages are the direct bytes `OFFER [4][kind][id]`, `ACCEPT [5][0][id]`, `CONFIRM [6][kind][id]`, `REPLY [7][code][id]`.

The relay gives each player a set of other players (the nearest 32 within 400 m and the nearest two beyond, for the maps; 8 anywhere on a relay of protocol 2) and says when it changes; a player who enters the set arrives with its latest state, so it is drawn at once. A STATE reaches only the players who have the sender in their set, thinned by the distance between the two: always under 150 m, else at most one per 200 ms under 350 m, per 1 s under 1200 m, per 2.5 s farther. A SAY reaches those within 400 m. A TO reaches the target only if the target has the sender in its set. A player that holds 12 or more has its states carried in BATCH frames while the relay is busy (`relay-worker/README.md`, "Batching"); the client treats every state of a batch as a state.

## Connecting

Nothing connects until the player has a name and has said yes on the name card ("Gioca online", or Online in Options). The card asks on every page open; only the name is remembered. "Gioca da solo" closes the socket and keeps it closed.

The socket is open while the player is online and the game has been played in the last 30 s. A game paused or left in the Garage for longer, or a page in the background, lets go of the relay (it closes a silent socket after 60 s anyway), and the next frame back reopens it. When the socket drops, every other player is forgotten at once (the cars go), then the page asks again after 1 s, 2 s, 4 s, 8 s and 16 s, each wait cut at random to between half and all of its step, so a thousand pages that lost the relay together do not come back together. A relay that cannot be reached, is full (503) or is over its daily allowance all look the same to the socket, and every try is a request that comes out of the one daily allowance, so a page that cannot get in gives up politely (`src/online/link.js`):

- After 6 failed attempts in a row with no successful connection in between, the link is stopped: no more tries on its own timer at the pace of the backoff. The player still sees the last state it knew (full, over for today, not available, or "Online..."), unchanged, and solo play carries on.
- A stopped link tries again (one attempt each) when the player asks (pressing "Gioca online" again, or the switch in Options, or going solo and back: at once, whatever it was waiting for); once in each hour at a random moment of it (the hours are counted from when it stopped, one attempt in each, so a crowd does not come back together); and when the browser says the network is back (`online`) or the page becomes visible after being hidden for at least 10 minutes, but those two at most once in 10 minutes. A game that is paused and played again does not count as asking.
- A reason that lasts until the day is over (`quota` or `budget` from `/status`, or the close for the address's own share) stops it until 00:00 UTC has passed plus a random 0 to 10 minutes, and neither the hour nor the network nor the tab gets in the way; only the player asking does. If it is still the reason after that, it waits for the next midnight. A reason from the day before is not a reason.
- A connection that stayed up 15 s resets everything (the six attempts start again from 1 s); one that dropped at once does not.

After each attempt the page may ask the relay why (next section), at most one request per attempt, none while stopped. `tools/online/link-check.mjs` (fake socket and clock, a simulated 24 hours) and `relaydown.mjs` test it; `relaydown.mjs` expects a relay that comes back to be found at once when the player asks and when the browser says the network is back, and not on its own within seconds (the hourly attempt is only tested with the fake clock).

## When online is not available

The relay is on Cloudflare's free plan, which has daily limits shared by every player, so "online is not there" is a normal thing that has to be said plainly. The states are told apart at a glance (code: `src/online/status.js`, shown by `online.js` and `panel.js`):

| State | Pill (colour) | When |
| --- | --- | --- |
| connected | players count (cyan ring), talk button | as always |
| connecting | `Online…` (grey dotted ring) | before the first answer and while asking again; says nothing else |
| full | `Online chinu` (amber) | `/status` says `full`, or the relay closed us with 1013 |
| over for today | `Online finutu pi oggi` (red) | `/status` says `quota` (the object's free daily limit is used up), or `budget` / close 1008 "daily allowance used" (only this address's share is used; its own sentence) |
| cannot be reached | `Online un funziona` (violet) | the socket will not open and `/status` cannot be read or says `error`: no reason is claimed |

The pill is the capsule of the multiplayer section (there while driving online); above it the panel shows one or two sentences, the same sentence comes once as a toast (6.5 s) when the state changes, and "L’online tuinnàu!" once when it recovers. "Over for today" says when it comes back: 00:00 UTC on the player's own clock (01:00 in Italy in winter, 02:00 in summer, from the browser's time zone). All the words are at the top of `src/online/status.js`, one constant per line (the Palermitan ones are the owner's drafts).

### How the reason is known

A browser cannot read the status or body of a failed WebSocket upgrade, so there is a side channel: `GET /status` on the relay's Worker (CORS for the game's origins and localhost / 127.0.0.1 with a port, `Cache-Control: private, max-age=5`, always 200 JSON). It answers `{"ok":true,"online":n,"max":m}`, `{"ok":false,"why":"full"}`, `"budget"` (this address's frames for today are used), `"quota"` (the call to the object failed with a message that names an exceeded limit) or `"error"` (it failed for any other reason). What Cloudflare documents:

- Worker over its own daily limit (free plan, 100,000 requests a day, resets at 00:00 UTC): "Cloudflare returns Error 1027" for a route that fails closed, an error page from Cloudflare, not from our code ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/); the [Workers errors](https://developers.cloudflare.com/workers/observability/errors/) page lists 1027 as "Worker exceeded free tier daily request limit"). The docs do not state the HTTP status. Such a response carries no CORS headers, so the browser fails the `fetch` or shows it as opaque: the page cannot tell it from a relay that is simply down, and says "not available right now" without a reason. (Fail open, the other mode, bypasses the Worker, which is no use to a relay.)
- Durable Object over its free limits (100,000 requests a day, 13,000 GB-s a day, plus SQLite rows; incoming WebSocket messages count 20 to 1; reset 00:00 UTC): "further operations of that type will fail with an error" ([Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)). The docs give no message text and no status for the stub's `fetch`. Users report messages such as "Exceeded allowed volume of requests in Durable Objects free tier" (found through search results, the Cloudflare community threads themselves could not be opened from here), and some say the errors outlast the reset by a few minutes. So the Worker catches whatever the stub throws and calls it `quota` when the text speaks of exceeding something or of the free tier, `error` otherwise (`relay-worker/src/status.rs`, unit tested). This is a best guess at the wording, not a documented contract: if the text differs, the player is told "not available right now" instead of "finished for today", which is still true.

The cost is kept near nothing: the page asks `/status` only after an attempt has failed (at most one request per attempt, one at a time), never while connected and never while the link is stopped; only when no reason is known yet, or when the player has just asked (the page keeps showing the reason it has while the link waits: a request after every hourly attempt would double its cost to repeat what the player has been told); never for a daily reason (`quota`, `budget`) already known, until 00:00 UTC has passed (then the first failed attempt asks again whether it is over); a close code the relay sent itself (1013, or 1008 with "daily allowance used") gives its reason with no request. The page's content security policy names the relay for both `wss:` and `https:` (`connect-src`, `tools/build/build.mjs`), so the `fetch` is allowed. `tools/online/states.mjs` walks all of it; `relaysim.mjs` has `/status` and `set({ status, maxConns, frameDay })` to produce each state.

## What a refused player costs

Requests to the relay per refused player in a day, the page left alone, counting every upgrade attempt (a WebSocket upgrade is one request) and every `/status`. Worked out from the rules, and the same numbers come out of the 24 simulated hours in `tools/online/link-check.mjs`.

Before (waits doubling to a 10 minute cap, each cut to half to all of its step, `/status` after every failed attempt): after the first 10 failures the average wait is 0.75 x 600 s = 450 s, and the first ten waits add up to 0.75 x 1023 s = 767 s. So about 1 + 10 + (3600 - 767) / 450 = 17 attempts in the first hour, and 1 + 10 + (86400 - 767) / 450 = about 200 in a day.

| Case | Before, per day | After, per day | 10,000 refused players, before | 10,000 refused players, after |
| --- | --- | --- | --- | --- |
| unknown (relay down, `/status` unreadable) | 200 attempts + 200 `/status` = about 400 | 6 + 24 attempts + 1 `/status` = 31 | about 4,000,000 | 310,000 |
| full (503, `/status` says full) | about 400 | 31 | about 4,000,000 | 310,000 |
| daily reason (quota, or the address's share) | 200 attempts + about 80 `/status` (one for every second or third attempt, 15 minutes apart) = about 280 | 4 (the first attempt and its answer, the attempt after midnight and its answer); 2 for the address's own share (no `/status`, the close says it) | about 2,800,000 | 40,000 (20,000) |

How the "after" numbers add up. Unknown and full: 6 attempts in the first half minute, then the link is stopped and the hours are counted from there: one attempt in each, 24 of them in the first 24 hours, so 30 attempts; `/status` is asked once, after the first failure, and its answer (full, or unreadable which is shown as "not available") is then known and kept, so the hourly attempts ask nothing more. Later days cost 24 or 25 attempts, no `/status`. Daily: the first attempt fails, `/status` says `quota`, the link waits for midnight (if the answer is slow a second or third attempt can start first, so up to 6 in the worst case); after midnight and the random few minutes one attempt, and one `/status` to learn whether it is over. When it is not, it waits for the next midnight. Over a full 24 hours the page that learned the reason at noon pays this once; a page that is already waiting pays 2.

What can add to it. A player pressing "Gioca online" costs one attempt (and one `/status`, except for a daily reason already known), at human speed. The browser's `online` event and a tab becoming visible after 10 minutes hidden are one attempt each, at most one in 10 minutes in all, so at most 144 more a day for a page whose network keeps flapping or whose player returns to it every 10 minutes all day, and none for a daily reason. A page left alone does not have any of these.

What it does not fix. 31 requests each is still 310,000 for 10,000 refused players, three times the whole day's allowance of 100,000: the rules give a stuck crowd an order of magnitude less than before, not a crowd that fits. A daily reason is the only case near zero. Two things would go further, if wanted: a longer gap than an hour (the hour is a rule of this change), and fewer than 6 first attempts. Also not measured against Cloudflare: whether a refused upgrade (and a `/status` that Cloudflare itself answers with its error page) is billed as a request, which is assumed here, and how late after 00:00 UTC the relay's object really recovers (the docs above say a few minutes at most for some users: a page that tries inside that window and still fails waits a whole day).

## What the client sends, and when

Only while the game is being played, as a STATE frame: a state goes when the car is no longer where `predict()` (`src/predict.js`) puts it from the last state sent (a turn, braking, a weave), and at least every second moving or every four seconds still (see below for when nobody holds us). Sender and receiver run the same `predict()`, and the receiver draws the car a little behind its latest state, carried on by the prediction, so sending less often adds no lag. Close by, a state goes when the car is more than 0.3 m, 3 degrees or 0.75 m/s off the prediction, or the steer, roll (0.075 rad), lean, flags or height change; farther out the tolerances of the path and of the body grow with the distance of the nearest holder over 25 m. (Before protocol 3: 0.2 m, 2 degrees, 0.5 m/s, roll 0.05, from 50 m, and the roll did not grow with distance.) What those tolerances cost is in `docs/ONLINE-CROWD.md`: on the pair of real pages of `bytes.mjs` the path is drawn 0.28 m off at the 95th percentile instead of 0.12 m, and 20 ms later at the start of a turn.

**Who the pace is for.** The relay thins each state by the distance to each receiver, so what a state needs is set by its nearest receiver. With protocol 3 the relay tells us (AUDIENCE) how far the nearest player that holds us is, as a band, and nobody holding us as band 0: we send for that distance, and with nobody only a keepalive (4 s moving, 15 s still; a nearer holder, or the first, is owed a state at once). Before protocol 3 the client guessed from its own set (the nearest player it holds, which is not who holds it) and a new player in the set was owed a state at once; that is still what it does when the relay does not send AUDIENCE (a relay of protocol 2, a simulator), with the old keepalives. The longest silence, 15 s, is under the relay's 60 s idle rule; what a player that vanishes without closing costs others is in the relay README.

INFO goes when the name, vehicle or livery changes, at most every 2.2 s. SAY and TO go when the player talks or makes an offer.

## What the client does with what it receives

Everything the relay sends is bytes made by strangers. `parseFrame()` (`src/online/wire.js`) returns null for a frame that is not exactly right: unknown type, wrong length, handle 0, a name field that lies or is over 64 bytes, a phrase index we do not have, reserved flag bits, a height over 1000 m, a position beyond 20 km. After that:

- Nothing but WELCOME is accepted before WELCOME, a second WELCOME is bad, and an ENTER with our own handle is bad.
- The table of players is capped at the number the relay said in WELCOME plus 8 (40 for 32; 16 for a relay of protocol 2), the room for an ENTER that comes before the LEAVE that makes space. At most 32 are drawn as cars (12 on a touch screen): the nearest, and only inside 400 m; every other player held is a ring and a name on the maps, with its position kept up to date and nothing built for it. A frame for a handle that was not introduced is dropped.
- A BATCH is checked entry by entry (2 to 16 entries, each handle not 0, each state exactly 18 or 20 bytes and valid, nothing left over); an entry for a handle that was not introduced is dropped by itself. AUDIENCE and BATCH from a relay that said protocol 2 are bad.
- Every player has a token bucket (burst 60, 40 a second), the relay as a whole has one (burst 1,280, 640 a second, a token for every state, those inside a batch too), a phrase from one player must be 1.2 s after the last, an offer 8 s, and a new name for a player in under about 1 s is dropped.
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
- **Maps.** Other players are a cyan ring with a name on the minimap and the big map: the players of the set (inside 400 m, and the two nearest beyond it), and the ones that are held but not drawn. A player that is not a car is a ring and a name.
- **Phone.** The most that is drawn is 12 on a touch screen and 32 elsewhere (`SHOWN_TOUCH`, `SHOWN_DESKTOP` in `online.js`). The measurements are in `docs/ONLINE-CROWD.md` (844x390, device scale 3, CPU slowed 4x, the real game page among bots): a desktop page draws 60 fps with 64 cars; the phone profile, 57 fps with nobody, 49 with 16 cars, 36 with 32 and 26 with 64.

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
| `link-check.mjs` | reconnecting, giving up, the hourly try, the daily wait, when `/status` is asked and the cost of 24 hours, with a fake socket and clock; no browser |
| `relay-rules.mjs` | the rules of protocol 2 from outside, with v2 bots; no browser; run it against any relay (a relay of protocol 3 serves them exactly as before) |
| `crowd.mjs` | N bots on a relay in a chosen layout (tight, street, city, mix) with the game's send rule, protocol 2 or 3; per player frames, bytes, delay and players held, and the relay's CPU with `--pid` (docs/ONLINE-CROWD.md) |
| `pagecrowd.mjs` | one real page among bots: frame time, cars drawn, online code time, the receiver's buffer |
| `netcompare.mjs` | the same remote car drawn from three send rules, side by side, in the real game: clips and roll numbers |
| `extensions.mjs` | does a relay answer permessage-deflate (it should not) |
| `relay-worker/test/v3-e2e.mjs` | protocol 3 against a running `wrangler dev`: HELLO and WELCOME, sets, audience, batches |

### Protocol 3 (20 Nov)

The pair above, on the relay of protocol 3 with the page of this branch (real pages, `bytes.mjs --scenario pair --relay`, 30 s each): both parked send 0.23 states a second each (0.50 before), one driving 1.4 (2.34 on average before), both driving 2.7 each (4.72). The car is drawn 0.05 m off its path at the median, 0.28 m at the 95th percentile and 0.54 m at worst (0.03, 0.12, 0.26 before) and 109 ms late at the start of a turn (88 before); steady driving is 57 ms behind as before. A crowd of 64 around one page, the relay's CPU with batching and the numbers for 8, 32 and 64 players per receiver are in `docs/ONLINE-CROWD.md`.

## Not done

- Not measured over a real network, through Cloudflare, from a phone, in Firefox or Safari.
- A relay that lies is only checked frame by frame: valid frames that say false things are believed (see `docs/SECURITY.md`).
- `src/online/relay-url.js` names the deployed relay; the game on `main` is not released with it yet.
- The relay's daily allowance is shared by everybody. A client that cannot get in gives up after 6 tries and then tries about once an hour (see "What a refused player costs"), but nothing stops a script from asking more often; that is the relay's per address limit's job, and it cannot do it completely: Cloudflare bills an incoming request or frame before the relay's code runs, so no rule in the relay can stop a script from spending the allowance (see the online multiplayer review in `docs/SECURITY.md`).
