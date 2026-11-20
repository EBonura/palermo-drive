# Online play with a crowd: what ships, and the measurements behind it

Written 20 November 2026. The relay of that morning held 8 players per receiver; this is protocol 3, which holds 32 (64 on request), carries them in batches, and tells every sender who is watching it, and the numbers that chose each constant. The owner stays on Cloudflare's free plan (no paid plan, 300 connections, one object, no sharding), so the first question of every change was: does it lower the incoming messages everybody shares? The second: does it let more nearby players through for the same bytes?

All load was local (`wrangler dev`, the Rust hub natively and as WebAssembly, a simulation of the crowd in virtual time) except the one short run against the deployed relay of section 11, made on the relay as it was before this work.

## Summary

**What changed for a player.** A player alone sends a state every 15 s parked and every 4 s driving instead of every 2.5 s. A player held by somebody sends for the nearest one that holds it, as the relay says (before: as the player guessed from its own set), and with looser tolerances (position 0.3 m, heading 3 degrees, speed 0.75 m/s, roll 4.3 degrees, from 25 m out). A player receives the 32 nearest within 400 m, and the two nearest beyond, instead of the 8 nearest anywhere, and gets them in batches of up to 16 states instead of one frame each. A phone draws the nearest 12 as cars, a desktop the nearest 32; the others are rings and names on the maps.

**What it buys** (simulation, 3 to 5 seeds, the shipped rule against the old one; section 4 and 5 have the tables):

| | before | now |
| --- | --- | --- |
| a player alone, parked | 0.40 states a second | 0.07 |
| a player parked among others | 0.50 | 0.26 |
| a player driving alone | 0.40 | 0.26 |
| a player driving in a pair | 3.86 | 2.36 |
| a player driving in a crowd of 8, 32, 64 | 5.03, 5.28, 5.34 | 3.97, 4.40, 4.41 |
| frames a second a player receives, tight crowd of 64, 8 players held (before) and 32 held (now) | 20.8 frames, 2.0 KB/s on the wire (estimated) | 18.6 frames, 2.4 KB/s, with four times the players |
| the same crowd with 32 players held under the old rules | 78 frames, 7.4 KB/s | 18.6 frames, 2.4 KB/s |
| the same with 64 held under the old rules | 172 frames, 16.6 KB/s | 15.8 frames, 2.2 KB/s (but a larger drawn error: section 5.4) |
| messages the free plan allows, an evening (assumed mix, section 4.3) | 229 player-hours a day | **308** |
| the same on a quiet day, on a launch hour | 377, 143 | **561, 182** |

The sending side moves the free plan's allowance by a third, which is all it moves: a car driving near others still has to send about 4 states a second for its neighbours to draw it within 30 cm, and nothing in the relay can change that. The receiving side costs nothing on the allowance (outgoing messages are free) and is where the nearby players come from.

**What it costs.** The path of a car is drawn 0.27 m off the truth at the 95th percentile instead of 0.12 m (real pages against the real relay, `bytes.mjs`: 0.12 to 0.28 m, worst 0.26 to 0.54 m) and the start of a turn is drawn about 20 ms later. A state arrives 33 ms later at the median, 50 at the 95th percentile, in a crowd where it is batched (at least 12 players held); alone or in a small group nothing is delayed. The page's draw buffer deepens from about 40 to about 78 ms in a crowd where it is batched: the batching delay is not hidden by the buffer, it is added to it (section 6.3); `BATCH_MS` is the constant to lower if that is too much. The roll of the body is the one change that needs the owner's eye (section 4.2, clips in `~/.cache/palermo-drive/netcompare/`).

**What is built and what is not.** Built: radius sets (400 m, nearest 32, two far slots at one state per 5 s), a per receiver budget of 120 states a second for sets above 32, batching (40 ms, only for receivers holding 12 or more, flushed by the next event: no timer), the audience frame, the longer keepalives, the looser send rule, the draw cap, `?k=` and `?shown=` for tests on localhost, and `no_web_socket_compression` in `wrangler.toml`. Not built, and why: a compact far state (saves a third of the bytes of players that are drawn small, and in a crowd there are none; section 5.5), sharding (the owner decided against it; section 9).

**To verify after deploying.** `node tools/online/extensions.mjs --url wss://pd-relay.bonniestudios.workers.dev/r --origin https://palermo-drive.it` prints whether the relay still answers `permessage-deflate`. The flag that turns it off (`no_web_socket_compression`, documented by Cloudflare) could not be shown to work here: `wrangler dev` answers the extension with or without it. The flag is on the whole Worker, so it applies to tables as well (the BLATERO frames are bigger and are no longer compressed).

## Contents

1. What is scarce, and what the plan allows
2. Tools and how the numbers were made
3. What ships: every constant and the measurement behind it
4. The sending side: states per player-hour
5. The receiving side: what a player gets, before and after
6. The page: drawing the cap, frame time, and the buffer
7. The relay's CPU, with batching running
8. What a version 2 page experiences, and the rollout
9. How many players at once, what a viral day costs, a full relay
10. Security
11. The real run (made before this work)
12. What was not measured


## 1. What is scarce, and what the plan allows

Cloudflare, Workers Free plan, Durable Objects (limits and pricing pages read on 20 November 2026):

* 100,000 requests a day and 13,000 GB-s of duration a day, reset at 00:00 UTC. Every 20 incoming WebSocket messages count as 1 request, every connection creation counts as 1 request; outgoing messages and protocol pings are not charged. (https://developers.cloudflare.com/durable-objects/platform/pricing/)
* CPU: a Durable Object event (a request or a WebSocket message) gets 30 s of CPU by default, configurable up to 5 minutes, free and paid alike; idle time does not count. The 10 ms per invocation of the plain Workers free plan applies to the front Worker (`glue.rs` `fetch`, which only checks the origin and hands the upgrade on), not to the object's message handlers. (https://developers.cloudflare.com/durable-objects/platform/limits/ and https://developers.cloudflare.com/workers/platform/limits/) So the CPU limit per event is not what limits the relay; see section 7 for what is.
* One object is single threaded and has a "soft limit of 1,000 requests per second"; beyond it callers get an overloaded error. The page does not say whether a WebSocket message counts as one of those requests. (limits page)
* A hibernating object with WebSockets: a maximum of 32,768 connections per object, "though CPU and memory usage may further limit it". (https://developers.cloudflare.com/durable-objects/api/websockets)
* Duration is billed in wall-clock time while the object is awake, on 128 MB regardless of what it uses, so an object awake for a whole day is 0.128 GB x 86,400 s = 11,059 GB-s (free allowance 13,000 a day). With players connected and sending, the object never hibernates, so it is awake all day on a busy day. (pricing page)
* Memory per Durable Object isolate: 128 MB. This figure is on the Workers limits page but the fetch I made of it did not return it; I am quoting it from my reading of that page and it is not verified here.
* Workers Paid ($5 a month): Durable Objects 1 million requests a month and 400,000 GB-s included, then $0.15 per million requests and $12.50 per million GB-s (pricing page). Workers requests (the front Worker): 10 million included, then $0.30 per million; CPU 30 million ms included, then $0.02 per million ms (https://developers.cloudflare.com/workers/platform/pricing/). Neither page lists a charge for the Durable Object's CPU, only requests and duration.

So on the free plan the incoming messages are what runs out: 100,000 requests x 20 = 2,000,000 incoming messages a day for all players together, and the relay then stops. Outgoing messages cost nothing, so how many players each one RECEIVES costs nothing on the allowance, and every state a player SENDS does. That is why the numbers below keep sending and receiving apart.


## 2. Tools and how the numbers were made

| Tool | What it is |
| --- | --- |
| `tools/online/crowd.mjs` | N bots on a relay (`wrangler dev` or the simulator), driving like players with the game's own send rule, protocol 2 or 3 (`--ver`), the old rule or the shipped one (`--rule today\|shipped`). Layouts tight, street, city, mix. Reports per player (frames, payload, wire, delay, players held) and for the relay. Up to 12 processes (`--procs`); `--pid` adds the CPU of a local workerd. |
| `relay-worker/hubbench/` | The relay's own `proto.rs`, `interest.rs`, `hub.rs` (included from `../src`, not copied) run in virtual time against the same crowd: `crowd` (traffic and the drawn error, 60 simulated seconds in about a second) and `bench` (CPU per incoming state, `--indegree` for fan-out). Builds natively and for `wasm32-wasip1`. |
| `tools/online/hubbench-wasm.mjs` | Runs that benchmark as WebAssembly in Node's V8. |
| `tools/online/pagecrowd.mjs` | A real game page among bots: frame time, cars drawn, the time its online code takes a frame, the receiver's buffer. |
| `tools/online/netcompare.mjs` | The same remote car drawn from three send rules, side by side, in the real game: the clips for the owner and the roll numbers. |
| `tools/online/extensions.mjs`, `deflate.mjs` | Does the relay answer permessage-deflate; what it would do to these frames. |

**The send rule.** `crowd.mjs` and the simulation each carry a copy of `stateDue()` of `src/online/online.js` (it lives in the client's closure and cannot be imported) with the same constants for the old rule and the shipped one, `predict()` from `src/predict.js` (imported by `crowd.mjs`, ported in the simulation) and the same frames (`wire.js` is imported by `crowd.mjs`). The pace is set by the audience the relay tells (protocol 3) or by the nearest player of the bot's own set (protocol 2), as in the game. A bot drives the loop of `bytes.mjs` (160 x 100 m, 25 m corners, 16 m/s on straights, 0.3 m weave) or is parked. Layouts: **tight** all inside a 100 m square; **street** along 1 km; **city** over 10 km, 8 clusters of 300 m and 10 % loners; **mix** half tight, a quarter on a street, a quarter in the city. Half drive unless said.

**The roll, and what it hides.** The simulated car needs a body roll, because the roll tolerance is one of the things that sends a state. The first version used a model fitted to the 4.7 states a second a real page sends on that loop. This version replays the roll the real game computed on that loop (25 s, `tools/online/netcompare-drive.json`, one value every 20 ms), from a phase of each bot's own. Calibration against the one real measurement, two pages that both drive (`bytes.mjs`, 4.72 states a second each): the replay gives 3.0 to 5.2 over six seeds (mean 3.9), the fitted model gave 4.7 to 6.6 (mean 5.5). The replay is the more honest shape (the real roll has rare large spikes, the model had many middling excursions, which made the roll tolerance worth a great deal in the model and little on the real recording) and it errs on the low side, so the savings below are, if anything, a little understated. In a crowd a driver sends more than in a pair (the nearest holder is close, so the tolerance does not grow): 5.3 states a second here; the real game in a crowd was never measured.

**Bytes on the wire.** Per frame the application payload, plus 2 bytes of WebSocket header downstream (relay to client, never masked) and 6 upstream (2 and a 4 byte mask). The "wire" estimate adds 22 bytes per frame for a TLS 1.3 record (5 header, 1 content type, 16 tag) and 52 bytes per TCP packet (IPv4 20, TCP 20, timestamps 12). Frames that the relay sends to one receiver in the same event share a packet; frames of different events do not, which is the pessimistic case for a real network that may merge frames sent a few milliseconds apart. Acknowledgements (about 52 bytes for every second packet, in the other direction) and TLS handshakes are not in it. It is an estimate; nothing here measured a real network.

**Drawn error.** Where a receiver's prediction (`predict()` from the last state it holds, at that state's age) puts a car, against where the car is, over every pair of one of 24 observed receivers and a player it holds, p95 in metres, by distance. The receiver's draw buffer is a constant on top of it. For comparison `bytes.mjs` (real pages) measures how far the drawn path is from the true path.

**Spread.** Simulated runs use 3 seeds (5 for the scenarios), different layouts and drivers; tables give the mean and the half range of the seeds where it matters. The Mac was at a load average of 30 to 50 all day: CPU timings are the minimum of repeats or taken from outside with `ps`; a difference inside the spread is not a finding.


## 3. What ships: every constant and the measurement behind it

| Constant | Value | Where | Why this number |
| --- | --- | --- | --- |
| `K` (a v2 player) | 8 | `proto.rs` | what pages from before send and hold (16 tracked, 8 drawn); never more, or an old page's tables overflow |
| `K_V3`, `K_MAX` | 32, 64 | `proto.rs` | 32 costs a tight crowd of 64 about what 8 cost before (18.6 frames, 2.4 KB/s against 20.8 frames, 2.0 KB/s); 64 is supported (`?k=64` on localhost, HELLO byte) but is thinned by the budget and drawn 0.9 m off (section 5.4) |
| `SET_RADIUS_M`, `SET_RADIUS_STAY` | 400 m, 1.15 | `proto.rs` | the game's `DRAW_R`: nothing a player does reaches farther than 400 m except the rings of the maps; a member stays until 15 % beyond so nobody flickers at the edge |
| `FAR_SLOTS`, `FAR_GAP_MS` | 2, 5,000 ms | `proto.rs` | the maps show the two nearest players beyond the radius when the neighbourhood is empty: +3 % frames in the first measurement of this, nothing on the allowance |
| `BUDGET_ABOVE`, `BUDGET_STATES_PER_S` | 32, 120 | `proto.rs` | a safety for sets above the shipped 32: at 120 a second a receiver of 64 gets each player about 1.9 states a second. It never acts at 32 (a tight crowd of 32 drivers is about 140 states a second after the looser rule) |
| `BATCH_MS` | 40 ms | `proto.rs` | median wait 33 ms, 95th percentile 50, in a crowd. 25 ms sends 1.4 times the frames, 100 ms sends a third fewer but waits up to 100 ms at the 95th percentile (sections 5.2 and 6.3) |
| `BATCH_MIN_HELD`, `BATCH_MAX`, `BUSY_GAPS` | 12, 16, 1 | `proto.rs` | below 12 held, the first measurement (4 players, 50 ms) waited up to 311 ms for lack of events to flush; 16 states is 322 bytes; one short gap is enough to call the relay busy (asking for two made the frames 50 % more in small crowds and left the tail where it was) |
| `AUDIENCE_EDGES`, `AUDIENCE_STAY` | 50, 100, 150, 250, 350, 600, 1200 m; 1.2 | `proto.rs` | the bands of the nearest holder; a nearer one is told at once, a farther one when 20 % past the edge |
| `KEEP_MOVING`, `KEEP_PARKED` | 1 s, 4 s | `online.js` | with an audience: the draw carries a car on for 1.5 s past a state (`remotes.js`), a receiver drops a still car after 16 s |
| `KEEP_MOVING_NOBODY`, `KEEP_PARKED_NOBODY` | 4 s, 15 s | `online.js` | nobody holds us: only the relay's idea of where we are needs keeping, and its idle rule closes a socket silent for 60 s |
| `DR_POS`, `DR_TH`, `DR_V`, `DR_ROLL`, `DR_SCALE` | 0.3 m, 0.05 rad, 0.75 m/s, 0.075 rad, 25 m | `online.js` | were 0.2, 0.035, 0.5, 0.05, 50: section 4.2 |
| `STALE_MS`, `STALE_PARKED_MS`, `STALE_FAR_MS` | 6 s, 16 s, 20 s | `online.js` | a moving car is dropped from the street after 6 s of silence; a still one is sent every 4 s, a ring beyond the radius every 5 s |
| `SHOWN_DESKTOP`, `SHOWN_TOUCH` | 32, 12 | `online.js` | cars drawn: the phone profile (CPU x4) held 49 fps with 16 cars, 36 with 32 and 26 with 64; a desktop 60 with 64 (section 6) |
| `GLOBAL_PER_S`, `GLOBAL_BURST`, `RATE_PER_S` | 640, 1280, 40 | `online.js` | 64 players driving in a crowd send about 7 states a second each, 450 in all; every state in a batch takes a token |
| `compatibility_flags` | `no_web_socket_compression` | `wrangler.toml` | compression of 21 byte frames saves 7 % at 90 microseconds a frame (section 5.6) |

Protocol: HELLO `[1][3][want][info]` (v2 `[1][2][info]` still served), WELCOME `[1][3][handle][online][k]`, BATCH `[8][n][handle][state] x n`, AUDIENCE `[9][band]`. The relay README is the reference.


## 4. The sending side: states per player-hour

Incoming states are what the free plan counts (2,000,000 a day for everybody), so this is the section that matters most. Everything here lowers what a player SENDS without making the drawn car visibly worse, and all of it is measured as what a player sends in a given situation.

### 4.1 The audience

The relay tells each v3 sender how far the nearest player that holds it is, as a band (frame 9), on the back of events that happen anyway: when one of its own states arrives and when its set of holders changes. The sender then sends for that distance and for nobody else. Two things follow that the client could not know from its own set: a player that nobody holds (it holds 20, but all of them have 32 nearer ones) sends only a keepalive, and a player held only from 400 m sends at the far band's pace instead of the near one. A new holder, or a nearer one, is owed a state at once; it holds our latest from its ENTER, possibly old.

What the relay needs from a silent player: its idle rule (60 s without a frame closes the socket) and its position for the interest recompute. A parked player nobody holds sends every 15 s (four times under the idle rule), a moving one every 4 s (a car moves 64 m in that time; the radius is 400 m and a newcomer that holds it gets a fresh state at once). A player that vanishes without closing its socket (a locked phone, a lost connection) stays in other players' sets for the idle rule's 60 s, exactly as before (the longest silence went from 2.5 s to 15 s, still under 60), and on their streets for at most 16 s if it was parked and 6 s if it was moving: the ghost costs the same as before for a moving car and ten seconds more for a parked one. A player's own set is recomputed on its own states, so a player nobody holds learns of newcomers at that pace, unless a newcomer holds it, in which case it is told at once and sends one: this is the one thing that is slower than before, and it concerns only a player that nobody sees.

### 4.2 The tolerances, and the roll

The old rule sent a state when the car was more than 0.2 m, 2 degrees or 0.5 m/s off the prediction or the roll had changed by 0.05 rad, judged from 50 m out; and the roll, steer and lean were not judged by distance at all. The new rule: 0.3 m, 3 degrees, 0.75 m/s, roll 0.075 rad, judged from 25 m out, the body (steer, roll, lean) by the same distance as the path, and nothing at all asked for the lights and the height when nobody holds us. What each part is worth, on the real roll (the 25 s recording of the game's own physics on the loop) for a receiver 20 m away:

| Rule | states a second | position off the truth, 95 % / worst | roll off, 95 % / worst |
| --- | --- | --- | --- |
| today | 5.28 | 0.204 m / 1.05 m | 0.028 rad / 0.094 |
| today with roll 0.075 | 5.24 | 0.231 / 1.35 | 0.030 / 0.094 |
| today with roll 0.1 | 5.12 | 0.204 / 1.05 | 0.030 / 0.099 |
| the new rule with roll 0.05 | 4.56 | 0.278 / 0.59 | 0.030 / 0.065 |
| **the new rule as shipped (roll 0.075)** | **4.36** | 0.275 / 0.59 | 0.032 / 0.074 |
| the new rule with roll 0.1 | 4.28 | 0.275 / 0.59 | 0.032 / 0.099 |
| the new rule with roll 0.15 | 4.20 | 0.276 / 0.59 | 0.037 / 0.117 |

The roll tolerance is worth little on the real recording: 0.05 to 0.075 is 4 % of the states, 0.075 to 0.1 another 2 %, and the roll drawn is off by 1.8 degrees at the 95th percentile either way (the first model of the roll, a fitted noise, said it was the biggest lever, 17 %: it was a property of the model; the real roll has spikes that no tolerance catches and few middling excursions). Position, heading, speed and the 25 m scale are worth 16 %. So the middle value ships, the owner can look at the clips (`~/.cache/palermo-drive/netcompare/`: `netcompare-wide.mp4` and `netcompare-close.mp4`, three cars side by side labelled TODAY 0.05, SHIPPED 0.075, LOOSE 0.10, with `README.txt` saying exactly what differs), and `DR_ROLL` is one constant. On the pair of real pages of `bytes.mjs` against the real relay: the path is drawn 0.05 m off at the median (was 0.03), 0.28 m at the 95th percentile (was 0.12) and 0.54 m at worst (was 0.26), and a turn is drawn 109 ms late at its start (was 88); steady driving is 57 ms behind as before.

### 4.3 States per player-hour, before and after

Simulation (the tight layout, 5 seeds, 90 s measured after 15 s; the numbers are what the player sends, not what the crowd costs the relay):

| What the player does | today: states a second (half range of 5 seeds) | now | today: states an hour | now | change |
| --- | --- | --- | --- | --- | --- |
| alone parked | 0.40 (+-0.00) | 0.07 (+-0.00) | 1,440 | 252 | -82 % |
| parked in a crowd of 64 | 0.50 (+-0.00) | 0.26 (+-0.00) | 1,800 | 936 | -48 % |
| alone driving | 0.40 (+-0.00) | 0.26 (+-0.00) | 1,440 | 936 | -35 % |
| driving in a pair | 3.86 (+-1.10) | 2.36 (+-1.26) | 13,910 | 8,496 | -39 % |
| driving in a crowd of 8 | 5.03 (+-0.12) | 3.97 (+-0.18) | 18,101 | 14,278 | -21 % |
| driving in a crowd of 32 | 5.28 (+-0.01) | 4.40 (+-0.01) | 19,008 | 15,854 | -17 % |
| driving in a crowd of 64 | 5.34 (+-0.03) | 4.41 (+-0.01) | 19,210 | 15,862 | -17 % |

The idle cases fall by a half to four fifths; a car driving near others, which is nearly all the allowance, falls by 17 to 39 %. The real pages of `bytes.mjs` against the real relay agree in kind: both parked 0.50 states a second each before, 0.23 now; one driving 2.34 on average before, 1.4 now; both driving 4.72 before, 2.7 now (on the simulator, which tells no audience, 2.0: the audience is not what gives the saving in that pair, the tolerances are).

**Player-hours a day that 2,000,000 messages buy**, for three assumed mixes of what players do (mine; the shares are in the table):

| Mix of what players do (my assumption) | today: states a second per player | now | today: player-hours a day | now |
| --- | --- | --- | --- | --- |
| a realistic evening: 15 % parked alone, 20 % parked among others, 20 % driving alone, 10 % in a pair, 20 % in a crowd of 8, 10 % of 32, 5 % of 64 | 2.43 | 1.80 | 229 | 308 |
| a quiet day: 30 % parked alone, 20 % parked among others, 25 % driving alone, 10 % pair, 10 % crowd of 8, 5 % of 32 | 1.47 | 0.99 | 377 | 561 |
| a launch hour: 5 % parked alone, 10 % parked among others, 10 % driving alone, 10 % pair, 25 % crowd of 8, 25 % of 32, 15 % of 64 | 3.87 | 3.04 | 143 | 182 |

On a viral day (15 minutes online per visitor, 1.5 connections each, the day spread flat; a trailer makes a peak and the free plan then runs out sooner):

| Visitors going online | Mix | free plan lasts, before | now |
| --- | --- | --- | --- |
| 1,000 | quiet day | all day (67,650 requests) | all day (46,050 requests) |
| 1,000 | an evening | 21.7 h (110,850 requests) | all day (82,500 requests) |
| 1,000 | a launch hour | 13.7 h (175,650 requests) | 17.4 h (138,300 requests) |
| 10,000 | quiet day | 3.5 h (676,500 requests) | 5.2 h (460,500 requests) |
| 10,000 | an evening | 2.2 h (1,108,500 requests) | 2.9 h (825,000 requests) |
| 10,000 | a launch hour | 1.4 h (1,756,500 requests) | 1.7 h (1,383,000 requests) |
| 100,000 | quiet day | 21 min (6,765,000 requests) | 31 min (4,605,000 requests) |
| 100,000 | an evening | 13 min (11,085,000 requests) | 17 min (8,250,000 requests) |
| 100,000 | a launch hour | 8 min (17,565,000 requests) | 10 min (13,830,000 requests) |

Nothing here changes the plain statement: the free plan buys a few hundred player-hours of play a day, the better part of a thousand if most of them stand still, and a launch day with ten thousand visitors uses it up in a few hours.


## 5. The receiving side: what a player gets, before and after

"Before" is protocol 2 as it was (the relay of the morning: 8 nearest anywhere, one frame for each state, the old send rule). "Now" is protocol 3 as shipped (32 within 400 m and two beyond, batches, the new rule). Same crowds, same seeds. Delay is not in these tables because the simulation has no network: the batch wait is (median 33 ms, 95th 50 ms in a crowd; section 5.2), and the delay of a real local relay is in section 7.

### Per player, per second (mean over the players, 3 seeds; half range of the seeds in brackets)

| Layout | N | Today (K 8): frames down | payload B/s | wire B/s (est.) | frames up | Ships (K 32): frames down | payload B/s | wire B/s (est.) | frames up | players held | batch wait p50/p95/p99 ms | drawn error p95 m (<50 m / <150 m): today | ships |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tight | 16 | 19.5 (+-2.6) | 401 | 1,852 | 2.93 | 11.7 (+-0.6) | 664 | 1,549 | 2.19 | 15 | 50/105/133 | 0.14 / 0.15 | 0.28 / 0.36 |
| tight | 32 | 18.6 (+-4.5) | 380 | 1,754 | 2.92 | 15.1 (+-0.8) | 1,356 | 2,506 | 2.21 | 31 | 33/72/100 | 0.14 / 0.16 | 0.24 / 0.31 |
| tight | 64 | 20.8 (+-4.5) | 426 | 1,965 | 2.98 | 18.6 (+-0.9) | 1,078 | 2,363 | 2.30 | 32 | 33/50/67 | 0.15 / 0.18 | 0.24 / 0.27 |
| tight | 128 | 24.4 (+-2.7) | 500 | 2,307 | 3.16 | 20.1 (+-0.5) | 1,266 | 2,579 | 2.45 | 32 | 33/50/50 | 0.17 / 0.19 | 0.25 / 0.32 |
| tight | 300 | 25.0 (+-1.0) | 511 | 2,356 | 3.11 | 19.6 (+-0.3) | 1,407 | 2,632 | 2.42 | 32 | 33/50/50 | 0.17 / 0.18 | 0.28 / 0.32 |
| street | 16 | 12.1 (+-0.5) | 252 | 1,163 | 1.97 | 9.4 (+-0.8) | 211 | 914 | 1.48 | 11 | 0/122/239 | 0.15 / 0.14 | 0.21 / 0.22 |
| street | 32 | 14.7 (+-1.3) | 300 | 1,383 | 1.99 | 11.7 (+-0.7) | 432 | 1,292 | 1.44 | 23 | 50/106/144 | 0.14 / 0.11 | 0.25 / 0.21 |
| street | 64 | 17.6 (+-0.9) | 350 | 1,609 | 2.10 | 17.4 (+-0.7) | 735 | 1,882 | 1.42 | 33 | 34/72/100 | 0.13 / 0.12 | 0.23 / 0.20 |
| street | 128 | 17.6 (+-0.6) | 345 | 1,578 | 2.09 | 21.5 (+-0.7) | 851 | 2,146 | 1.36 | 34 | 33/55/72 | 0.13 / 0.12 | 0.22 / 0.19 |
| street | 300 | 16.4 (+-0.4) | 323 | 1,479 | 2.07 | 27.2 (+-0.4) | 975 | 2,429 | 1.39 | 34 | 33/50/50 | 0.12 / 0.11 | 0.22 / 0.20 |
| city | 16 | 4.9 (+-0.9) | 102 | 472 | 1.61 | 2.2 (+-0.7) | 43 | 206 | 0.94 | 4 | - | 0.16 / 0.28 | 0.20 / 0.61 |
| city | 32 | 8.0 (+-0.4) | 168 | 776 | 2.12 | 4.6 (+-0.4) | 95 | 443 | 1.27 | 5 | - | 0.16 / 0.26 | 0.20 / 0.52 |
| city | 64 | 13.3 (+-0.4) | 278 | 1,284 | 2.37 | 9.3 (+-0.6) | 201 | 906 | 1.53 | 8 | 33/67/84 | 0.18 / 0.22 | 0.23 / 0.42 |
| city | 128 | 18.7 (+-0.8) | 388 | 1,794 | 2.68 | 12.7 (+-0.2) | 480 | 1,436 | 1.84 | 16 | 34/50/61 | 0.18 / 0.20 | 0.28 / 0.37 |
| city | 300 | 21.5 (+-0.7) | 441 | 2,037 | 2.79 | 16.1 (+-0.5) | 991 | 2,171 | 1.99 | 29 | 34/50/50 | 0.17 / 0.18 | 0.29 / 0.32 |
| mix | 16 | 11.5 (+-1.5) | 239 | 1,106 | 1.82 | 7.6 (+-1.2) | 157 | 728 | 1.30 | 6 | - | 0.13 / 0.18 | 0.18 / 0.26 |
| mix | 32 | 12.9 (+-1.4) | 265 | 1,224 | 2.20 | 8.0 (+-0.2) | 366 | 968 | 1.56 | 11 | 45/95/111 | 0.14 / 0.15 | 0.25 / 0.33 |
| mix | 64 | 13.4 (+-2.5) | 274 | 1,265 | 2.35 | 10.6 (+-0.4) | 744 | 1,542 | 1.68 | 20 | 33/66/83 | 0.13 / 0.16 | 0.23 / 0.30 |
| mix | 128 | 16.1 (+-2.5) | 328 | 1,514 | 2.44 | 13.6 (+-0.9) | 669 | 1,630 | 1.76 | 24 | 33/50/67 | 0.15 / 0.18 | 0.24 / 0.27 |
| mix | 300 | 20.7 (+-1.3) | 422 | 1,945 | 2.68 | 17.6 (+-0.6) | 913 | 2,073 | 1.95 | 28 | 33/50/50 | 0.17 / 0.19 | 0.26 / 0.32 |

### Before at K 32 (what 32 players per receiver would have cost without any of this)

| Layout | N | frames down | wire B/s | now (ships K 32): frames down | wire B/s |
| --- | --- | --- | --- | --- | --- |
| tight | 64 | 78.0 (+-13.0) | 7,430 | 18.6 (+-0.9) | 2,363 |
| tight | 128 | 89.9 (+-7.9) | 8,485 | 20.1 (+-0.5) | 2,579 |
| tight | 300 | 98.8 (+-5.2) | 9,269 | 19.6 (+-0.3) | 2,632 |
| street | 64 | 48.6 (+-3.0) | 4,649 | 17.4 (+-0.7) | 1,882 |
| street | 128 | 63.8 (+-3.3) | 5,986 | 21.5 (+-0.7) | 2,146 |
| street | 300 | 74.5 (+-1.0) | 6,702 | 27.2 (+-0.4) | 2,429 |
| city | 64 | 21.8 (+-0.9) | 2,105 | 9.3 (+-0.6) | 906 |
| city | 128 | 36.9 (+-2.4) | 3,564 | 12.7 (+-0.2) | 1,436 |
| city | 300 | 64.2 (+-2.9) | 6,199 | 16.1 (+-0.5) | 2,171 |
| mix | 64 | 51.1 (+-6.5) | 4,925 | 10.6 (+-0.4) | 1,542 |
| mix | 128 | 51.9 (+-6.9) | 4,940 | 13.6 (+-0.9) | 1,630 |
| mix | 300 | 66.3 (+-4.3) | 6,246 | 17.6 (+-0.6) | 2,073 |

### The relay

| Layout | N | events/s in: today | ships | frames out/s: today K 8 | ships K 32 | today K 32 |
| --- | --- | --- | --- | --- | --- | --- |
| tight | 64 | 190 | 147 | 1,283 | 3,322 | 4,879 |
| tight | 300 | 934 | 725 | 7,218 | 20,357 | 28,518 |
| street | 64 | 134 | 91 | 1,042 | 2,231 | 3,053 |
| street | 300 | 620 | 415 | 4,478 | 13,441 | 20,546 |
| city | 64 | 152 | 98 | 844 | 613 | 1,384 |
| city | 300 | 837 | 597 | 6,237 | 14,405 | 19,129 |
| mix | 64 | 150 | 108 | 824 | 2,321 | 3,241 |
| mix | 300 | 804 | 587 | 5,950 | 13,099 | 19,200 |


Reading it. A player gets four times the players (up to 32 near it, the two nearest far ones, held 4 to 34 depending on the city) for the same frames a second and about the same bytes: tight crowd of 64, 20.8 frames and 2.0 KB/s on the wire (estimated) before, 18.6 frames and 2.4 KB/s now. Under the old rules 32 players would have cost 78 frames and 7.4 KB/s, 64 would have cost 172 and 16.6; the old cost grows with the players a receiver holds, the new one with the batches and does not. The relay's incoming events a second fall by 20 to 35 % (the sending side), its outgoing frames rise (4 times the receivers) and the CPU per frame sent is what section 7 measures. The drawn error p95 within 50 m goes from 0.14 to 0.24 m in a crowd of 64 (the new tolerances plus a state 33 ms late in the batch), and is larger beyond 150 m in a thin city, because the tolerance of the sender grows with the distance of its nearest holder (0.18 to 0.32 m at 150 m in a city of 300).

### 5.1 Radius sets and far slots

A v3 set is the players within 400 m, the nearest K of them, and the nearest two beyond. Compared with the nearest K anywhere (measured earlier, the same hub): at K = 8 almost nothing, because the 8 nearest are inside 400 m anyway except in an empty city; at K = 64 in a thin population it halves the traffic (city of 64: 35 to 16 frames a second) because nobody receives the far players that would have filled the slots. In a crowd it changes nothing, everybody is within 400 m. So the radius is the right shape for a big K: K becomes a cap on a neighbourhood. What the game loses: the rings on the maps of everybody beyond 400 m except the two nearest, which are kept (as slow rings, one state per 5 s: +3 % frames in the first measurement) so that an empty neighbourhood is not an empty map; the panel still says how many are connected, from the relay's ONLINE frame.

### 5.2 Batching

A v3 receiver holding at least 12 players has its states carried together: the first state after a quiet spell goes out at once; one that comes within 40 ms of the last frame sent to that receiver, while another event came less than 40 ms before, waits, and the next event of anybody at or after 40 ms from the state's arrival sends the waiting states as one frame (16 at most). There is no timer. The wait is bounded by the gap to the next event, not by a clock: a state waits only while events are arriving less than 40 ms apart, the receiver holds 12 or more players, and every one of them sends at least once a second moving and every four seconds still; so the wait is at most 40 ms plus the gap to the next event, at most 1 s when anybody near is moving, and 4 s when everybody is still (in which case nothing waiting is a car in motion). `hub::tests::a_batch_never_waits_for_a_frame_that_may_not_come` runs 4,000 random events and asserts that no state is left waiting after an event that is past its time and that no wait exceeds 40 ms plus the longest gap between events; `a_batch_never_holds_a_state_while_the_relay_is_quiet` that with events 200 ms apart nothing waits at all.

Measured (simulation, tight crowd, the frames a receiver gets a second and the wait added, the same crowd without batching in the first row):

| Batch X | players held | frames a second | wire B/s (est.) | wait p50 / p95 / p99 / max (ms) | drawn error p95 within 50 m |
| --- | --- | --- | --- | --- | --- |
| none | 63 | 140 | 13,600 | 0 | 0.18 m |
| 25 ms | 63 | 26.0 | 4,830 | 17 / 50 / 50 / 100 | 0.22 |
| **40 ms (ships)** | 63 | 18.2 | 4,220 | 33 / 50 / 67 / 100 | 0.24 |
| 50 ms | 63 | 18.2 | 4,220 | 33 / 50 / 67 / 100 | 0.24 |
| 100 ms | 63 | 10.3 | 3,600 | 50 / 100 / 117 / 134 | 0.29 |

(3 seeds, the new send rule, 64 asked for and the budget switched off so that batching is the only change. The simulation steps 16.7 ms at a time, so 40 and 50 ms flush at the same step here; on the real relay events come when they come. The first measurement of this, with the old send rule, had 214.6 frames and 20.8 KB/s unbatched against 20.5 frames and 5.9 KB/s at 50 ms.)

The 100 ms of the max column is the 16.7 ms frame of the simulation: the longest wait of a state that arrived two events before a quiet spell. In rooms with few events the tail is longer, because there is less to flush a box: 16 players (a receiver holds 15 and the relay sees 40 events a second) waited 50 / 105 / 133 / 272 ms, 32 players 33 / 72 / 100 / 128. This is the reason for `BATCH_MIN_HELD`: with 4 players in the relay (10 events a second) the first measurement of 50 ms waited 94 / 173 / 311 ms; below 12 held nothing waits now. Whether 40 ms hides inside the game's own buffer is section 6.3: partly.

### 5.3 The budget

Above 32 held a receiver is sent at most 120 states a second, shared out by distance (weight 1 / (1 + d / 60 m)). At 32 it never acts. At 64 it gives each player about 1.9 states a second, and a driver 5 m away is then drawn 0.9 m off at the 95th percentile (0.89 / 1.82 m within 50 / 150 m in a tight crowd of 64, against 0.24 / 0.27 at 32): that is why 64 is supported and not shipped. The same budget at 160 a second gave 0.47 m in the first measurement; it is one constant (`BUDGET_STATES_PER_S`). It counts only the players inside the radius: the far slots have their own pace.

### 5.4 64 players per receiver

Asked for with `?k=64` (or the HELLO byte): what it cost before (the old rules, K = 64) and what it costs now. The budget thins each player to about 1.9 states a second above 32 held, which is why the drawn error is large in a tight crowd:

| Layout | N | Before, K 64: frames down | wire B/s | Now, K 64: frames down | wire B/s | players held | drawn error p95 <50 m / <150 m |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tight | 64 | 171.5 (+-20.4) | 16,637 | 15.8 (+-0.4) | 2,161 | 63 | 0.89 / 1.82 |
| tight | 128 | 170.1 (+-10.7) | 16,207 | 20.8 (+-0.4) | 2,234 | 64 | 1.05 / 1.57 |
| tight | 300 | 182.8 (+-8.7) | 17,180 | 23.4 (+-0.3) | 2,301 | 64 | 1.13 / 1.80 |
| street | 64 | 66.1 (+-3.4) | 6,414 | 14.8 (+-0.5) | 1,738 | 44 | 0.24 / 0.22 |
| street | 128 | 99.2 (+-5.2) | 9,469 | 20.1 (+-0.6) | 2,169 | 65 | 0.32 / 0.35 |
| street | 300 | 135.5 (+-2.2) | 12,647 | 27.2 (+-0.3) | 2,491 | 66 | 0.65 / 0.64 |
| city | 64 | 31.3 (+-0.3) | 3,037 | 9.3 (+-0.6) | 906 | 8 | 0.23 / 0.42 |
| city | 128 | 47.5 (+-2.8) | 4,585 | 12.6 (+-0.2) | 1,426 | 16 | 0.28 / 0.38 |
| city | 300 | 83.2 (+-7.1) | 8,030 | 14.8 (+-0.4) | 1,908 | 34 | 0.45 / 0.69 |
| mix | 64 | 60.0 (+-6.7) | 5,815 | 10.6 (+-0.4) | 1,542 | 20 | 0.23 / 0.30 |
| mix | 128 | 106.2 (+-9.5) | 10,240 | 12.2 (+-0.6) | 1,530 | 39 | 0.88 / 1.81 |
| mix | 300 | 115.5 (+-5.9) | 10,951 | 17.5 (+-0.6) | 1,871 | 49 | 1.04 / 1.60 |



### 5.5 The compact far state: not built

A state without steer, roll, lean and flags, 11 bytes instead of 18, for players beyond a distance. Measured before batching: beyond 150 m it saved 5 to 17 % of the payload in a thin city, and forced from 20 m in a tight crowd of 64 a third (4,234 to 2,871 B/s) with no change in the drawn position; with batching on top, the payload goes from 4,330 to 2,731 B/s and the wire estimate from 5,886 to 4,309. After batching the wire bytes are mostly headers that batching has already removed, the players that are drawn small are the ones near the edge of a crowd (few), and what it costs is what it leaves out (roll, lights, which are visible at 20 m) and a second parse path for the client to fuzz. Not worth its complexity; the batch frame leaves room for a second entry type if that changes.

### 5.6 permessage-deflate

Every browser offers it, and the relay answers it (the deployed relay did, measured in the first run; `wrangler dev` does). What it would do to the frames one receiver gets in a 64 player crowd (6,049 frames of 21 bytes, `deflate.mjs`): compressing every message alone makes them larger (105 %), keeping the window between messages gets 92.6 % at 90 microseconds of CPU a frame in Node's zlib; with batches of 200 bytes 79 % at 298 microseconds. At 30 or more frames sent for every state received that is a CPU cost far over what the rest of the relay does, for 7 %. So the Worker's `compatibility_flags` has `no_web_socket_compression`, a flag Cloudflare documents (https://developers.cloudflare.com/workers/configuration/compatibility-flags/: `web_socket_compression` enabled by default since 2023-08-15, `no_web_socket_compression` to disable). A browser's WebSocket cannot decline an extension it offers, so this is the only place. Under `wrangler dev` the relay answers the extension with the flag as well as without it (the local proxy in front of workerd negotiates it), so the flag could not be shown to work; after a deploy, `tools/online/extensions.mjs --url wss://... --origin https://palermo-drive.it` says what the real relay answers. The flag is for the whole Worker: the tables for BLATERO are no longer compressed either.


## 6. The page: drawing the cap, frame time, and the buffer

### 6.1 The draw cap

A page receives up to K players and draws the nearest N as cars: 32 on a desktop, 12 on a touch screen (`SHOWN_DESKTOP`, `SHOWN_TOUCH`; `?shown=N` for tests, localhost only). Every other player it holds is a ring and a name on the maps, with its position kept up to date and nothing built for it (the remote is in the "far" mode of `remotes.js`, which was made for players beyond 400 m). A player beyond 400 m is a ring whatever its rank. The ranking has 50 m in hand for a car already drawn, so two players at the same distance do not swap; a newcomer is ranked before anything is built for it, so thirty players arriving together do not all become cars for an instant.

### 6.2 Frame time with 32 and 64 received

`pagecrowd.mjs`: one real game page (production-style bundle, `--test-relay`), driving a loop inside a tight crowd of bots (half driving) on a local `wrangler dev` of the relay of this branch (the real Rust relay as WebAssembly), asking for 64 players, 20 s measured after 12 s or more, 2 repetitions. Frames from `requestAnimationFrame`; "online code" is the time inside `update()` plus the time handling frames. Headless Chrome (muted, the slot wrapper), Metal GPU, on a Mac at a load average of 30 to 50. Desktop is 960x540; the phone profile is 844x390 at scale 3 with the CPU slowed 4 times.

| Profile | Players received (bots) | Cars drawn / rings | fps | frame ms p50 / p95 / p99 | frames over 50 ms | online code ms a frame (update + frames) | frames and states received a second | states sent a second |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| desktop | 0 | 0, 0 / 0, 0 | 60, 60 | 16.7, 16.7 / 16.7, 16.8 / 16.8, 16.8 | 0, 0 | 0.016, 0.015 + 0, 0 | 0, 0 / 0, 0 | 0.25, 0.25 |
| desktop | 32 | 32, 32 / 0, 0 | 60, 60 | 16.7, 16.7 / 16.7, 16.7 / 16.8, 16.8 | 0, 0 | 0.139, 0.132 + 0.006, 0.006 | 15, 17 / 63, 87 | 5.95, 6 |
| desktop | 64 | 32, 32 / 32, 32 | 60, 60 | 16.7, 16.7 / 16.8, 16.8 / 16.8, 16.8 | 0, 0 | 0.208, 0.187 + 0.006, 0.006 | 16, 16 / 45, 45 | 5.8, 5.85 |
| phone | 0 | 0, 0 / 0, 0 | 58.7, 59.3 | 16.7, 16.7 / 16.8, 16.8 / 33.3, 33.3 | 0, 0 | 0.063, 0.067 + 0.001, 0 | 0, 0 / 0, 0 | 0.25, 0.25 |
| phone | 32 | 12, 12 / 20, 20 | 45.4, 51.4 | 16.7, 16.7 / 33.4, 33.4 / 50.1, 50 | 11, 6 | 0.55, 0.464 + 0.022, 0.022 | 15, 16 / 62, 89 | 5.85, 5.9 |
| phone | 64 | 12, 12 / 52, 52 | 53, 51.5 | 16.7, 16.7 / 33.4, 33.4 / 50, 50 | 9, 5 | 0.514, 0.537 + 0.023, 0.028 | 16, 16 / 44, 45 | 5.55, 5.5 |

(two repetitions in each cell, in order; the page asked for 64)

Before this work, the same page drew every player it held as a car and held at most 8 (so the table has no row with more than 8 cars); the draw cap of 8 was chosen from phone measurements of the peer to peer client. The first measurement of a page drawing 16, 32 and 64 cars on the phone profile, on a simulator relay and with nothing capped, gave 49, 36 and 26 fps. `nocap.json` repeats it on this relay with `?shown=64` for the table above: 

| Profile | Players received (bots) | Cars drawn / rings | fps | frame ms p50 / p95 / p99 | frames over 50 ms | online code ms a frame (update + frames) | frames and states received a second | states sent a second |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| phone | 32 | 32, 32 / 0, 0 | 50.4, 43.3 | 16.7, 16.7 / 33.4, 33.4 / 33.4, 33.4 | 0, 0 | 0.537, 0.649 + 0.025, 0.027 | 15, 16 / 63, 89 | 5.8, 5.9 |
| phone | 64 | 64, 64 / 0, 0 | 23.3, 29.2 | 49.9, 33.3 / 50.1, 50 / 66.7, 66.7 | 51, 24 | 1.303, 1.082 + 0.079, 0.044 | 16, 16 / 45, 45 | 5.15, 5.3 |

(two repetitions in each cell, in order; the page asked for 64)

The owner expected no problem. On the desktop profile that holds: 60 fps with 32 cars and 32 rings, no frame over 20 ms, the online code 0.2 to 0.25 ms of a 16.7 ms frame. On the phone profile the cap of 12 is what holds the frame rate: the online code is 0.5 ms a frame there at CPU x4 (about a quarter of that on a real phone core, not measured), and drawing 32 or 64 cars is not.

### 6.3 Does 40 ms of batching hide in the buffer?

The receiver's buffer follows how late states come over the earliest it has seen (`remotes.js`: `1.5 x jitter + 10 ms`, at least 30). A state held for 0 to 40 ms by the relay is a state with up to 40 ms of jitter, so the buffer should deepen with it, not hide it. Measured on the page (16 bots around it, desktop, 3 repetitions; asking for 11 players means nothing is ever batched, asking for 32 means it is): 

| Page asks for | batched | buffer behind the sender, ms (3 repetitions) | jitter the buffer follows, ms | frames received a second | states received a second |
| --- | --- | --- | --- | --- | --- |
| 11 | no | 39, 40, 39 | 8, 7, 6 | 14, 22, 23 | 13, 21, 22 |
| 32 | yes | 80, 78, 75 | 56, 49, 51 | 13, 13, 13 | 29, 43, 46 |

The buffer goes from about 40 ms to about 78 ms: the jitter the page sees goes from 6 to 8 ms to 49 to 56 ms, and the buffer follows it. So the batching wait is not hidden inside the buffer the client already keeps: in a crowd (12 held or more) a car is drawn about 38 ms further behind its state than it was, and the frames received fall from 14 to 23 a second to 13 while the states received rise (the page asking for 32 holds 15 here, the one asking for 11 holds 11). Whether that matters is a judgement about cars, whose drawn error is already 0.27 m; the constant is `BATCH_MS` (25 ms would send 1.4 times the frames and deepen the buffer by about 24 ms), and below 12 held nothing is batched.


## 7. The relay's CPU, with batching running

### 7.1 The hub

The hub's own work for a state, native and as WebAssembly (V8, the engine Workers run), is the table below (from the relay of the morning, `bench`, minimum and median of 9 repeats on a loaded Mac; the minimum is the better estimate). Protocol 3 adds bookkeeping per event (the audience, the boxes): with a crowd sending in turn every 5 ms, the hub spends **2.25 microseconds an event at 16 receivers against 1.38 before, 4.4 against 2.8 at 32, and 10.8 against 7.1 at 63** (native, minimum of 7) and sends **13 times fewer frames** (4.7 per event against 63 at 63 receivers).

| Receivers holding the sender (W) | Native min / median | WebAssembly (Node V8) min / median | Native, set recomputed each event |
| --- | --- | --- | --- |
| 0 | 321 / 481 | 329 / 554 | 388 / 580 |
| 1 | 481 / 687 | 462 / 486 | 560 / 876 |
| 4 | 596 / 2,471 | 600 / 1,517 | 810 / 836 |
| 8 | 851 / 2,277 | 872 / 936 | 1,300 / 1,329 |
| 16 | 1,376 / 2,217 | 1,429 / 4,534 | 2,061 / 2,250 |
| 32 | 2,379 / 9,123 | 2,553 / 13,645 | 4,271 / 19,609 |
| 64 | 4,698 / 18,106 | 9,518 / 25,211 | 10,904 / 22,090 |
| 128 | 40,099 / 52,849 | 30,240 / 64,306 | 30,736 / 116,065 |
| 256 | 117,085 / 159,809 | 75,926 / 172,746 | 289,681 / 483,860 |

### 7.2 The runtime, which is where the cost is

Under `wrangler dev` (the real Rust relay as WebAssembly in `workerd`), measured from outside with `ps` over 30 s, less the idle CPU, a tight crowd, the same bots (half driving, the shipped rule) asking for 11 players (below the batch size: one frame for each state) or 32 (batched): 

| Crowd | players asked for | frames a player gets a second | states a second | events a second | CPU, one core = 100 % (2 repetitions) | microseconds an event | delay p50 / p95 / p99 ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| protocol 2 (the old relay behaviour, 8 held, the old rule) | 8 | 27.66, 27.28 | 26.78, 26.42 | 474.4, 467.6 | 28.8 %, 39.6 % | 607, 846 | 2/6/12 ; 4/12/19 |
| tight 64, 11 asked (never batched) | 11 | 20.01, 20.01 | 18.97, 18.99 | 153.6, 154.2 | 15.9 %, 17.2 % | 1035, 1118 | 2/8/13 ; 2/9/15 |
| tight 64, 32 asked (batched) | 32 | 18.98, 18.91 | 55.24, 54.33 | 154.4, 153.8 | 13.9 %, 15.4 % | 903, 1003 | 35/53/69 ; 35/53/69 |
| tight 128, 11 asked (never batched) | 11 | 26.61, 26.71 | 25.43, 25.54 | 341.7, 342.7 | 27.1 %, 31.1 % | 792, 907 | 2/9/18 ; 2/11/23 |
| tight 128, 32 asked (batched) | 32 | 20.62, 20.66 | 63.77, 64.22 | 343.5, 343.7 | 29.4 %, 27.2 % | 855, 791 | 35/55/62 ; 35/54/60 |

Reading it. A page that asks for 11 players is never batched, so each of its states is a frame; a page that asks for 32 is batched: it gets about three times the states in the same number of frames (19 frames and 55 states a second against 20 frames and 19 states a second, tight 64), and the relay spends the **same CPU or a little less** for it (14 to 15 % of a core against 16 to 17 %, about 900 to 1,000 microseconds an event against 1,035 to 1,118; tight 128: 27 to 29 % against 27 to 31 %). That is the claim: 32 players per receiver, batched, cost what 11 cost unbatched. The delay is the batching wait added to a local relay's 2 ms: 35 / 53 / 69 ms at the median, 95th and 99th percentile in the crowd of 64.

What the first measurements gave for the relay as it was (the old protocol, 7.6 to 63 frames sent for an event, tight crowds of 32 to 128): about 430 microseconds an event plus about 30 microseconds for every frame sent. These runs say the fixed part is the larger: about 800 to 900 microseconds an event whatever it sends, and 15 to 20 microseconds a frame (7 frames fewer is 130 microseconds), so a batch of 16 states is one send but the event that carries it still costs what any event costs. I estimated before this that batching would take an event at 63 receivers from 2.4 ms to 0.6 ms; it takes it from about 2.4 ms (the old relay with 63 receivers, measured) to about 0.9 ms (32 receivers batched, measured here), and the 63 receiver batched case was not run in `workerd` (the budget caps it at 120 states a second, and the 64 player run of the first measurement, 128 players asking for 64, was 30 % of a core). These are numbers of a local `workerd` on a loaded Mac, including loopback socket work that Cloudflare does not bill as CPU: an upper bound on what the plan's limit sees. What bounds one object is the events a second it takes (about 1,100 here, section 9), which batching does not change; what batching changes is how many players each of those events can reach.


## 8. What a version 2 page experiences, and the rollout

A page from before protocol 3 (cached, or open in a tab through the deploy) sends HELLO `[1][2][info]`. The relay serves it exactly as before: the 6 byte WELCOME, the 8 nearest players anywhere, one STATE frame for each state, no BATCH, no AUDIENCE, thinned by the same bands. Everything it sends is read as before. `relay-worker/test/e2e.mjs` (every frame and limit of protocol 2, unchanged) passes against the new relay, and `hub::tests::a_v2_player_keeps_its_eight_nearest_anywhere_and_never_sees_a_v3_frame` fixes the rule. What differs for it is not its own: it holds players that now send fewer states (the new rule on the other pages), up to 15 s apart when they are parked and nobody holds them. A v2 page holds a player that way only while it is in its set, which makes the player's audience non-empty, so the player sends every 4 s (parked) or 1 s (moving) to it: inside the 6 s a v2 page waits before it drops a silent car from the street. A v2 page and a v3 page in one room see each other; `tools/online/smoke.mjs` and `hello.mjs` run with the page of origin/main against the new relay (section 8.1).

**Order of deployment.** The relay first (nothing changes for any page), then the page. A new page speaking to an old relay does not work: the old relay closes a HELLO of version 3 with 1008, so the relay must not be rolled back below protocol 3 while pages with version 3 are cached (`link.js` would retry with its backoff and the player would play solo, with the pill saying the relay cannot be reached). If that ever has to happen, the client can fall back to a v2 HELLO after two closes without a WELCOME; that was not built.

**Version 3 against the new relay.** `relay-worker/test/v3-e2e.mjs` (HELLO and WELCOME, a bad HELLO, audience, radius and far slots, batches under load, BATCH and AUDIENCE sent by a client), the browser tools of section 12 run with the page of this branch, and `crowd.mjs` against a running `wrangler dev`.

### 8.1 A version 2 page and a version 3 page, in the browser, against the new relay

The page of origin/main (protocol 2) was built with `--test-relay` and driven by origin/main's own tools; the page of this branch by this branch's tools. Both against the new relay under `wrangler dev` (the real Rust relay as WebAssembly), and the same tools against their own simulator for the baseline.

| Tool | v2 page, new relay | v3 page, new relay | v2 page, its own simulator (baseline) | v3 page, simulator |
| --- | --- | --- | --- | --- |
| `smoke.mjs` | passes | passes | | passes |
| `cap.mjs` | passes: told exactly 8, holds 8, draws 8, the nearest, a far bot that drives up replaces the farthest | passes (asks for 12, draws 8, the other 4 are rings; may be told 2 more beyond its radius) | | passes |
| `bytes.mjs --scenario pair` (states a second each: both parked, one drives, both drive) | 0.50, 2.34, 4.67 (the same as before this work: nothing for a v2 page changed) | 0.23, 1.41, 2.72 | | 0.50, 1.13, 1.97 (the simulator tells no audience) |
| `hello.mjs` | 3 lines fail as on the baseline, and one more, see below | the same 3, and the same one more | 3 lines fail | 3 lines fail |
| `offer.mjs`, `wheel.mjs` (simulators only) | | | 5 and 5 lines fail | 5 and 5 lines fail |

The lines that fail in `hello.mjs`, `offer.mjs` and `wheel.mjs` fail the same way with origin/main's page and origin/main's tools against origin/main's simulator, so they are not from this work: the tools expect Palermitan lines that the spelling changes of today replaced ("nun ci va" against "un ci va", "Bob è occupatu" against "Bob n’havi abbastanza", and so on), the oscillator counts of the sound checks read 0 in the muted headless browser, and `offer.mjs` expects a drunk picture to move more. The one more line, `and Bob is told "Anna è vicino"` of `hello.mjs`, fails against the real relay with either page and passes against the simulator: the real relay delivers Anna to Bob so fast that Bob's page says "Anna è vicino" at its first moment, before the test moves it (the page's own `lastHello` of that player read 842 ms), and then does not say it again within a minute, as designed. It is a race in the test, not a difference of the relay.

`tools/release/smoke.mjs` on a production build (no `--test-relay`, the page policy that allows only the deployed relay) passes: title, start list, credits, pub, phone title, garage, garage phone, and the three drives, no error on any.


## 9. How many players at once, what a viral day costs, a full relay

The owner decided to stay on the free plan: `MAX_CONNS` stays 300, there is one object, nothing is sharded. This section is what was measured for that decision, on the relay as it was before protocol 3 (about 2.5 events a second a player in the 30 % driving mix; protocol 3 sends about 0.73 of that, and about the same CPU an event, so the numbers below move by that much in the players' favour, which was not measured again). Section 4.3 has the viral table with the measured mixes before and after; the table of 9.2 uses the assumed rates of the first measurement and has the paid plan's arithmetic.

### 9.1 One object: where it breaks

`MAX_CONNS` (300 today) is a number nobody measured. Here it is, built with the limit raised to 5,000 connections and 100,000 per address (a temporary build option, not kept in the code), K = 8, a city with 8 clusters of 300 m and 10 % loners, 30 % driving, against `wrangler dev` (the Rust relay as WebAssembly in `workerd`), on a Mac at a load average of 30 to 50 and with the harness (Node, up to 8 processes) on the same machine, which is not a quiet bench. CPU is the CPU time of the two `workerd` processes from `ps`, less their idle CPU, over the measured 30 s.

| Players | Events a second the relay was offered / took | Relay CPU (one core = 100 %) | Microseconds a state | Delay p50 / p95 / p99 / max (ms), harness included | Frames a player got a second |
| --- | --- | --- | --- | --- | --- |
| 300 | 787 | 53 % | 675 | 5 / 16 / 30 / 75 | 20.2 |
| 450 | 1,143 | 71 % | 617 | 5 / 16 / 32 / 128 | 19.3 |
| 600 | about 1,500 offered, 566 taken | 76 % | 1,334 | every sample over 2,000 ms (the histogram's last bucket) | 2.6 |
| 1,000 | about 2,500 offered | 100 % of a core, memory 1.6 GB | | the object stopped answering `/stats` for more than 5 minutes and was killed | |

The same relay built with K = 64, a tight crowd (frames sent per event 31 to 63):

| Players | Events a second | Frames sent a second | CPU | Microseconds an event | Delay p50 / p95 / p99 / max (ms) | Frames a player got a second |
| --- | --- | --- | --- | --- | --- | --- |
| 32 | 84 | 2,587 | 15 % | 1,777 | 2 / 6 / 8 / 23 | 80.9 |
| 64 | 203 | 12,474 | 50 % | 2,473 | 4 / 18 / 30 / 42 | 195 |
| 128 | 498 | 24,718 | 81 % | 1,631 | 5 / 49 / 77 / 108 | 196 |

Reading both. (i) On this machine one object comfortably takes about 1,100 events a second (450 players of the 30 % driving mix, delay under 130 ms) and falls over somewhere between 1,150 and 1,500 (600 players): after that the queue grows without bound, nothing is dropped, and everything arrives later and later (the 600 and 1,000 runs); a real Cloudflare object would answer overload with an error ("overloaded", the documentation says) rather than by growing a queue, which was not tested. This matches the documented soft limit of 1,000 requests a second. (ii) A straight line through the cost of an event against the frames sent for it (675 microseconds for 7.6 frames, 1,777 for 31, 2,473 for 63) gives about 430 microseconds an event plus about 30 microseconds for every frame sent: the cost of a state is mostly what the glue and the runtime do per `send_with_bytes`, 400 times what the hub itself spends (70 ns). So **fan-out is paid in the runtime, not in the hub, and batching (one send for many states) is also the main CPU lever**: with batching at X = 50 a receiver gets about 20 frames a second instead of 200, which at 64 players cuts the frames sent per event from 63 to about 6 and the cost of an event from about 2.4 ms to about 0.6 ms by the same line (**an estimate from this fit: the batched relay was not run in `workerd`**). In a crowd of 128 at K = 64 the object is at 81 % of a core before batching and p99 delay 77 ms. (iii) Memory in `workerd` under `wrangler dev` grows into gigabytes under overload (queued output for slow readers); it says nothing about Cloudflare's 128 MB, except that a relay that is behind holds its backlog in memory.

Natively (the hub alone in virtual time, same crowd):

| Players | Hub memory (whole simulation, max RSS) | Events a second (30 % driving, city, K = 8) | Frames out a second |
| --- | --- | --- | --- |
| 300 | 4.4 MB | 719 | 5,101 |
| 1,000 | 8.7 MB | 2,500 | 17,363 |
| 3,000 | 19.9 MB | 7,419 | 46,018 |
| 5,000 | 32.6 MB | 12,468 | 73,945 |

and the cost of the lazy recompute of sets (a player's set is recomputed on its next state at least a second after the last: every state event costs this one in ten, and the work grows with the number of players, because every recompute looks at every other player): nanoseconds per incoming state native, minimum of 5 repeats, with W = 8 holders and F other players in the city:

| F (other players) | state, no recompute | state with recompute |
| --- | --- | --- |
| 0 | 800 | 1,211 |
| 700 | 5,143 | 19,091 |
| 2,700 | 18,975 | 78,872 |
| 4,900 | 41,376 | 167,902 |

At N = 5,000, each of 5,000 players recomputes once a second at about 170 microseconds: 0.85 s of CPU a second, natively, before the sockets: past one core. At 1,000 players it is 20 microseconds x 1,000 = 2 % of a core; at 3,000 it is 79 microseconds x 3,000 = 24 %. It is O(N squared) and has a simple cure if it is ever needed (a grid of 400 m cells, so that a recompute looks at the 9 cells around the player and not at everybody).

What breaks first, in order: (1) **events a second on one thread.** The state of a player is an event; the 30 % driving mix sends 2.4 to 2.5 states a second per player on average, so 1,000 players are 2,500 events a second. One object is single threaded, the documentation gives it a soft limit of 1,000 requests a second, and in the local measurement above 1,000 events a second is about a core (675 to 980 microseconds an event, glue included). So one object takes about **400 players of this mix**, about 1,000 players if most are parked (0.5 a second each: 500 events a second at 1,000 players), and about 150 in a tight crowd of drivers (6.6 a second each). Whether the documented 1,000 requests a second applies to WebSocket messages is not stated on the page; if it does, the same numbers follow. (2) the recompute above, at several thousand. (3) the allowance of the plan, section 9.2: 2,000,000 messages a day is 23 messages a second on average, an object that takes 1,000 events a second exhausts a day in 33 minutes. (4) memory: the hub is 32 MB for 5,000 players in the simulation (including the bots); the per connection record in the attachment is 170 to 300 bytes and the per address tables are 200,000 entries at most (`MAX_ADDRESSES`), at about 64 bytes an entry 13 MB. The object's memory limit is 128 MB (unverified, section 1); the local `workerd` showed 100 MB resident idle and 460 MB with 300 players, which is the development runtime with its tooling, buffers for slow readers and a loaded machine and is not comparable. (5) The 32,768 connections of the hibernation API: not near.

**What I would set `MAX_CONNS` to today: 300 is about right and should stay for the free plan.** At 300 players the measured load is 800 events a second at 30 % driving (53 % of a core locally), where one object is comfortable, and 300 players at 2.4 states a second is 62 million messages a day if it ran for 24 hours: far more than the allowance. The cap does not protect the object, it protects the plan: the allowance (2,000,000 messages) is used in 46 minutes by 300 players on that mix. If the owner pays for the Workers plan, raise it to 400 (the number the single thread takes, measured here) per object and add objects (7.4) before raising it further.

### 9.2 What a viral day costs

Inputs: rates are measured or simulated (section 4.3 has the measured rates; the first measurement used 0.6, 1.5 and 4.0 states a second); prices and limits are Cloudflare's (section 1); the visitors, the minutes and the number of connections per visitor are **my assumptions** (15 minutes online per visitor, 1.5 connections per visitor, flat over the day for "how long into the day", spread evenly: a real day is not flat and a trailer makes a peak, so the free plan runs out sooner than the flat figure). Three mixes of what players do: quiet (0.6 states a second: mostly alone, parked or driving with nobody near), mixed (1.5: some company), busy (4.0: driving near others, near the measured 4.7).

| Visitors going online | Mix | Incoming messages | Request equivalents (msgs / 20 + 1.5 connects per visitor) | Free plan (100,000 requests a day) | Paid plan: Durable Object requests beyond the 1,000,000 a month included, at $0.15 per million |
| --- | --- | --- | --- | --- | --- |
| 1,000 | quiet | 540,000 | 28,500 | survives | $0 |
| 1,000 | mixed | 1,350,000 | 69,000 | survives | $0 |
| 1,000 | busy | 3,600,000 | 181,500 | runs out after 13 h of a flat day | $0 |
| 10,000 | quiet | 5,400,000 | 285,000 | runs out after 8.4 h | $0 |
| 10,000 | mixed | 13,500,000 | 690,000 | runs out after 3.5 h | $0 |
| 10,000 | busy | 36,000,000 | 1,815,000 | runs out after 1.3 h | (1,815,000 - 1,000,000) x $0.15 / 1e6 = $0.12 |
| 100,000 | quiet | 54,000,000 | 2,850,000 | runs out after 0.8 h | (2,850,000 - 1,000,000) x 0.15 / 1e6 = $0.28 |
| 100,000 | mixed | 135,000,000 | 6,900,000 | runs out after 0.3 h (18 minutes) | $0.89 |
| 100,000 | busy | 360,000,000 | 18,150,000 | runs out after 0.1 h (6 minutes) | (18,150,000 - 1,000,000) x 0.15 / 1e6 = $2.57 |

The paid plan's bill for the day is those figures plus the $5 a month that Workers Paid costs anyway (and the duration: one object awake all day is 11,059 GB-s, inside the 400,000 GB-s a month included, 13,333 a day; the front Worker's requests are one per connection, 150,000 for 100,000 visitors, inside the 10 million included). The free plan, in a day with 10,000 visitors who go online, **stops after 1 to 8 hours** and then the relay answers every new player with an error and every player that is on loses the others; the game goes on solo. The plan does not bill beyond the allowance: it stops. The paid plan costs the $5 a month and, for the viral day, a few dollars at most: $2.57 for 100,000 visitors in the busy mix. The cost of paying is therefore small; what a paid plan does not do is make one object able to hold the concurrent crowd of 100,000 visitors (7.3): the average concurrent number for 100,000 visitors of 15 minutes is 1,042 and a trailer peak is several times that.

Which numbers are which. Measured: parked 0.5 states a second, driving near another player 4.7, the 20:1 count of the plan (as published) and the glue's CPU. Simulated with a fitted model: 0.4 a second alone, 6.6 in a crowd, the mixes' averages, the player-hours. Cloudflare's: the allowance, 20:1, $0.15 per million Durable Object requests beyond 1 million a month, $12.50 per million GB-s beyond 400,000, $5 a month, $0.30 per million Worker requests beyond 10 million. Mine: 15 minutes, 1.5 connections, the flat day, the 0.6, 1.5 and 4.0 mixes, that the bill has no other line (storage: the relay stores nothing; a Durable Object's SQLite storage is not used beyond the attachments, which live in the socket).

### 9.3 When one object is not enough

A single object takes about 400 players of the driving mix or about 1,000 mostly parked ones (7.1), and the average concurrency of a 10,000 visitor day is about 100 (not a problem), of a 100,000 visitor day about 1,000, with a peak several times higher.

The simplest sharding that keeps "you see the players near you": **by area of the map, one object per cell, with the cell chosen by the player's position**, e.g. a grid of 2 km cells over the 10 km city (25 objects, `idFromName("cell-x-z")`). A player holds a WebSocket to the object of its cell; the client reconnects when it crosses into another cell (it is told by the relay: a frame with the cell's neighbours, or it computes it from its own position). Near a border a player needs the players on the other side: either it is connected to two objects at once (the object of its cell and the nearest neighbouring cell when it is within 400 m of the border; the second socket receives only, sending its own state to both would double its cost on the allowance, so it sends to the one it is in and the objects exchange the border states), or the objects exchange the states of players within 400 m of a shared border by calling each other (an RPC from object to object per state, a request each: with 1,000 border states a second that is 1,000 requests, 20 times the cost of the messages themselves; on the paid plan $0.15 per million, on the free plan it counts against the same 100,000). The two-sockets variant costs the client a second connection near borders (about 5 to 10 % of the time at a 2 km cell with a 400 m margin: the margin band is 1 - (1.2/2)^2 = 64 % of a cell by area, which is a lot; with 4 km cells it is 36 %) and nothing at the relay; the object-to-object variant costs the plan more requests and a design for ordering. A cell with a stadium in it is still one object: sharding by area does not split a crowd; it splits a city.

Cost in object time: each object is awake only while it has a connection, so a day on which the players are spread over 25 cells costs the same total number of messages and 25 objects' awake time instead of one, at most 25 x 11,059 GB-s = 276,000 GB-s a day against 13,000 free (the free plan allows one such object: sharding does not fit the free plan at all) and 400,000 a month included on the paid plan (a month of 25 busy objects is 8.3 million GB-s, about $100, if all were awake all day; real cells are not awake all day, an idle cell hibernates and costs nothing).

**Recommendation.** Do not build it before launch. The numbers say: on the free plan the day's allowance goes long before the object does (7.2), and sharding needs the paid plan to make sense; the limit of one object is about 400 concurrent drivers or 1,000 mostly parked, a crowd that the free plan cannot afford for more than a few minutes anyway. The decision is the owner's: if he is going to pay, build the sketch above only when a single object shows its 1,000 events a second in the real `/stats` (a counter that already exists, `framesIn`, differenced), and until then keep `MAX_CONNS` at 300 on the free plan and at 400 on the paid. What to do before launch is cheaper than sharding: the send rule (5.4) halves the messages, the client's refusal behaviour (7.4) stops a full relay from costing requests, and batching (5.1) lets each receiver cope at 32 or 64.

### 9.4 What the client does when the relay is full or the allowance is gone

From the code. `src/online/link.js`: a failed upgrade (403, 429, 503, a handshake that never finishes) closes the socket, `failed()` sets a wait of 1 s doubling to a cap of 10 minutes (`BASE_MS`, `CAP_MS`), each cut at random to between half and all of its step, and nothing is shown to the player. `online.js` `onClose` calls `forgetAll()` (the cars go, the panel says "ancora nessuno"), `update()` goes on and the game is played solo: `net.update` returns after `rm.update` when the link is not open, and sending is guarded by `ready`. `tools/online/link-check.mjs` (no browser, a fake socket and clock, ran today: ALL PASSED) shows the waits 1, 2, 4, 8, 16, 32, 64, 128, 256, 512 s, then 600 s every time, 500 ms with the least random number, and a connection that lived 20 s starting again from 1 s. `tools/online/relaydown.mjs` (browser) runs the whole story with a relay that goes away, answers 503 on every upgrade, and comes back: no new dialog, the panel still shows, the car still drives, no more than 8 attempts in 30 s of 503, the player is back when the relay takes players again, and no page error other than the browser's own log of the refused socket. Run today against the simulator with the build of this work: ALL PASSED (the relay comes back and she finds it again, 503 on every upgrade, 0 asks in the 30 s window after the long backoff had built up, the browser's online event reconnects at once, no page errors).

What a crowd of refused clients costs, by simulation of that backoff (2,000 pages): a page that stays open and in play while refused makes **17 attempts in the first hour, 73 in 8 hours, 201 in a day** (the cap of 10 minutes with the random cut averages 450 s). The earlier review's 43,000 a day for 300 stuck players is 143 each, a cap of 600 s with no cut; with the cut it is 60,000 a day for 300 and **about 2 million a day for 10,000**. Every attempt is a request (one to the front Worker, and one to the object when it answers 503), and the free plan's allowance is 100,000 requests: **10,000 refused players ask 170,000 times in their first hour**, more than the whole day's allowance. When the allowance is already gone the plan itself stops the requests and they cost nothing more; when the relay is merely full (MAX_CONNS) every refused page spends requests the real players need. A cap of 30 minutes gives 74 attempts a day (a third); and the client can do better than any cap: after, say, 6 consecutive failures of a session without ever having connected, stop asking until the player does something (the Online button, a new page load). That bounds a refused player to about 8 requests for the whole session. The client cannot tell "full" from "down" from "over its allowance" (a browser WebSocket does not see the status code), so one rule has to do for all three. This is a change for `link.js`, small, and it is what stops a viral day from being made worse by its own refusals; I recommend it before launch whatever else is done.


## 10. Security

`docs/SECURITY.md` has the review ("Online protocol v3"). The numbers: one state reaches the players who hold the sender, which with sets of 8 was at most 33 receivers in a 300 player crowd (measured; 48 in the plane, the 6 K bound), and is now **104 at K = 32 and 174 at K = 64** (59 and 117 in a crowd spread over 400 m; a hostile client choosing its place can reach 192 at 32 and the whole relay, 299, at 64). One hostile socket is limited to 12 states a second, so the most it makes the relay send is **2,304 frames a second at K = 32** and 3,588 at 64 (576 before): outgoing frames cost nothing on the allowance and the object about 70 ns each in the hub and 30 microseconds each in the runtime (7 % of a core for the 32 case; batching sends the same states in fewer frames). What one sender can push into one victim did not grow: 12 states, 1 SAY, 2 TO and 0.5 ENTER a second, about 15 frames, whatever K is (`hub::tests::one_hostile_sender_cannot_push_more_than_its_rate_into_a_victim`). A page counts every state inside a batch against the sender's bucket (40 a second) and the whole relay's (640 a second, burst 1,280), and checks a batch entry by entry (`fuzz.mjs`: 200 batches of 16 at once, a count that lies either way, a short entry, a leftover byte, handle 0, reserved flag bits, a height flag with no height, an entry from a handle never introduced, BATCH and AUDIENCE to a page whose relay said protocol 2). The worst disconnect (the most held player of a natural crowd of 300 leaves) takes 6.7 ms natively at K = 32 and 10.9 ms at K = 64 on a loaded Mac in one event (0.3 ms at K = 8), about 63 microseconds a holder, so 19 ms for the attacker's best case of a player held by all 299; a Durable Object event has 30 s of CPU, so this is a pause for everybody on the relay, not a limit.

What the audience frame gives an attacker: standing near players makes them send more (a parked player held by somebody sends every 4 s instead of every 15 s: 0.18 states a second more each, at most 64 victims per socket, about 12 incoming messages a second of the shared allowance per attacker). The relay README says how a ghost (a player whose page vanished) costs the same as before.


## 11. The real run (made before this work)

This is the one real run of the first measurement, against the relay as it was (protocol 2, 8 players per receiver).

Against `wss://pd-relay.bonniestudios.workers.dev/r`, Origin `https://palermo-drive.it`, 13:24 to 13:25 UTC on 20 November 2026, from this Mac: 19 bots (`crowd.mjs --allow-remote --layout tight --n 19 --secs 35 --warm 8`, the game's send rule, half driving) for 43 s of sending and 1 extra connection that only asked for compression and closed without sending (20 connections in all, from one address, under the 24 allowed). `/stats` before: `{"online":0,"connections":0,"framesIn":0,"framesForwarded":0,"framesThinned":0,"bytesIn":0,"dropped":{}}`. In the middle of the run (at the start and the end of the 35 s window): framesIn 316 to 2,280, framesForwarded 2,068 to 15,098, 19 connected, nothing dropped, thinned 0. `/stats` after the bots closed: `{"online":3,"connections":3,"framesIn":2443,"framesForwarded":16209,"framesThinned":0,"bytesIn":46162,"dropped":{}}` (the 3 connected are somebody else's: before the run there were none). So the run cost 2,443 incoming messages, 0.12 % of the day's 2,000,000 (about 122 request equivalents) and 20 requests for the connections.

| | Real relay (19 bots, K = 8, tight) | `wrangler dev` (32 bots, K = 8, tight, local) | Simulation (32 players, K = 8, tight) |
| --- | --- | --- | --- |
| Frames a player received a second (mean, p95) | 20.2, 28.2 | 18.6, 35.0 | 22.1, 39.7 |
| Payload bytes a second a player received | 415 | 380 | 453 |
| States a player sent a second (driving, parked) | 2.97 (6.86, 0.70) | 2.74 (6.65, 0.69) | 3.54 |
| Players held | 8 | 8 | 8 |
| Delay, sender's stamp to arrival at another bot of the same process, p50 / p95 / p99 / max (ms) | **65 / 160 / 289 / 775** | 2 / 9 / 19 / 45 | 0 |

Delivery: the bots received 20.19 frames a second each over 19 bots, 384 a second; the relay's counters say it forwarded 372 a second in the same window (including the frames after an ENTER): the difference is inside the 1 s granularity of the windows, nothing was lost between the relay and the sockets, and no connection was closed (`closed: 0`). What the real network adds is one round trip to the edge and to the object in western Europe, 65 ms at the median and 160 at p95 between two bots on this machine (a path of bot to edge to object to edge to bot), with a tail to 775 ms: far more than the local 2 ms and about the size of the game's own 55 ms draw buffer again. Players in Italy with a nearer edge may see less. Compression: the edge answered the upgrade with `permessage-deflate; client_max_window_bits=15` when it was offered (the probe connection), so the deployed relay negotiates it with browsers; the bots in the run did not offer it. 5.5 shows what that is worth for these frames (about 7 % at best, at 90 microseconds a frame).


## 12. What was not measured

* Cloudflare's real CPU, billing and soft limit. CPU numbers for the relay are from `workerd` under `wrangler dev`, measured from outside with `ps` on a Mac at a load average of 30 to 50 (Workers freeze their clocks inside, so a Worker cannot time itself), and include loopback socket work Cloudflare does not bill. Whether WebSocket messages count against an object's 1,000 requests a second soft limit, the object's real memory against 128 MB, and the real bill were not measured.
* That `no_web_socket_compression` works: `wrangler dev` answers the extension with it. After a deploy: `tools/online/extensions.mjs`.
* A real phone and mobile networks. The phone profile is Chrome's emulation (844x390, scale 3, CPU x4) on a Mac GPU. TCP and TLS overhead is an estimate (section 2), the radio's power was not measured.
* The real game's send rate in a crowd (the simulation is calibrated on a pair of real pages and replays the real roll of one loop; a crowd of real pages was never run), real players' driving, how long they play and how many are in a crowd (assumptions, stated where they are used).
* What the looser tolerances look like beyond the three-car clip: the clip is the real game's remote car on one recorded drive. The drawn error counts positions; the roll is judged in the clip and in the roll numbers of section 4.2.
* A batching delay on a real network (the local delay is a loopback), packet loss and head of line blocking.
* A relay of protocol 3 holding more than the 300 connections of `MAX_CONNS`, or running for hours.
* Safari and Firefox.
