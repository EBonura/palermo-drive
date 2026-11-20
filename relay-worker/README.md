# Palermo Drive relay (Cloudflare Worker, Rust)

Every player holds one WebSocket to this relay, sends its own state, and receives the players near it. Players never learn each other's network address. The relay simulates nothing and trusts nothing: it parses just enough of a state to know where a player is, decides who gets whom, and forwards the game's own small messages. The game keeps validating every byte it receives.

This is protocol v2. It is not the older server in `../relay/`.

## Hosting and why it is shaped this way

One Worker (Rust, `worker` crate 0.9, built with `worker-build`) and ONE Durable Object (`id_from_name("main")`, SQLite class, WebSocket Hibernation API), created with the location hint `weur` because the players are in Italy. The hint only applies when the object is first created.

The free plan allows 100,000 requests a day, with incoming WebSocket messages counted 20 to 1 (about 2 million a day), and 13,000 GB-s a day, which is about one busy object all day. It stops with errors when exceeded and never bills. Outgoing messages are free. So incoming frames are the scarce resource, nothing here uses a timer (an alarm would keep an idle object awake), and every time based rule is checked lazily when the next event arrives.

## Endpoint

`GET /r` with a WebSocket upgrade. Refused with 403 unless `Origin` is in the allowlist (the `ORIGINS` variable in `wrangler.toml`, comma separated, default `https://palermo-drive.it`). `http://localhost:<port>` and `http://127.0.0.1:<port>` are always allowed for development and tests. A request with no Origin is refused too (browsers always send one). Without an upgrade header: 426. `GET /stats` returns JSON counters and nothing that identifies a player. Anything else: 404.

All frames are binary, little endian, first byte is the type. A text frame closes the socket (1003).

## Game payloads carried

- **info**: `[vehicle u8][livery u8][nameLen u8][name utf8]`. The name is at most 16 runes (the game's `MAX_NAME_RUNES`) and 64 bytes, valid UTF-8, no control characters. The relay does not interpret vehicle or livery.
- **state**: the game's FAST body without its type byte: `[time u16][position 5][heading u16][speed i16][steer i8][roll i8][lean i8][flags u8][curvature i16][accel i8]` (18 bytes), plus `[height u16]` when flags bit 3 is set (20 bytes). The relay applies the same checks as the game's `unpackFast`: exact length, flag bits 4 to 7 clear, height at most 10000 (1000 m in tenths), and `|x|` and `|z|` under 20000 m. Anything else is malformed. The position is 40 bits, x in the low 20 and z in the high 20, 0.05 m units with 2^19 added (the same as the game's `packFast` and `relay/src/protocol.rs`). The relay reads x and z and nothing else.
- **phrase**: one byte, an index into the game's phrase list. Not checked.
- **direct**: 1 to 8 bytes the relay does not interpret (the game's OFFER, ACCEPT, CONFIRM, REPLY).

## Client to relay

| Type | Layout | Meaning |
| --- | --- | --- |
| 1 HELLO | `[1][ver u8 = 2][info]` | First frame, once. A bad or second HELLO, or any other first frame, closes the socket (1008). |
| 2 INFO | `[2][info]` | Name, vehicle or livery changed. At most one every 2 s. |
| 3 STATE | `[3][state]` | The player's car. Also the keepalive: the game sends one at least every 2 s. |
| 4 SAY | `[4][phrase u8]` | A phrase for the players near. |
| 5 TO | `[5][handle u16][direct]` | A direct message for one player. |

## Relay to client

| Type | Layout | Meaning |
| --- | --- | --- |
| 1 WELCOME | `[1][ver u8 = 2][handle u16][online u16]` | Answer to HELLO: the connection's handle (1..65535, unique among live connections) and how many players are connected. |
| 2 ENTER | `[2][handle u16][info]` | This player is now one of yours, or one of yours changed its info. Always sent before that player's first STATE. A receiver must treat a repeat for a known handle as an info update. |
| 3 LEAVE | `[3][handle u16]` | No longer one of yours (went far, or disconnected). |
| 4 STATE | `[4][handle u16][state]` | |
| 5 SAY | `[5][handle u16][phrase u8]` | |
| 6 TO | `[6][from handle u16][direct]` | |
| 7 ONLINE | `[7][online u16]` | The number of connected players changed. At most once every 10 s per connection, and only on the back of a frame that connection sent (the game sends a state at least every 2 s), never from a timer. |

## Who gets whom

Each player R has a set of at most `K = 8` other players: the K nearest by the last position each sent, anywhere in the city. 8 is the game's `MAX_PLAYERS` in `src/p2p/p2p.js`. A player that has not sent a STATE yet is in nobody's set and has an empty set.

- R's set is recomputed when a STATE from R arrives and at least 1 s has passed since R's last recompute, and straight away when a member of R's set disconnects. To stop two players at about the same distance swapping places, a player outside the set replaces the farthest one inside it only if it is at least 30 m nearer. Empty slots are filled with the nearest players without that margin.
- ENTER and LEAVE tell R about changes to its set. When someone enters, its latest known state follows the ENTER at once, so it appears without waiting for its next state.
- A STATE from S is forwarded to every R that has S in its set, thinned by distance with the game's send bands: always under 150 m; else only if 200 ms have passed since the last one forwarded to that R (under 350 m), 1 s (under 1200 m), 2.5 s (farther). Each gap is applied 5 ms short, as the game's own sender does, so a client sending exactly on the period does not lose a state to timer jitter.
- A SAY from S goes to every R that has S in its set and is within 400 m (the game's `DRAW_R`).
- A TO from S to T is forwarded only if T has S in its set, otherwise dropped silently and counted.
- Membership is not symmetric: each receiver gets its own nearest K.

## Limits

Over a limit means dropped and counted in `/stats`, unless a close is stated.

- Frame size: 96 bytes at most; larger closes 1009. A malformed frame (wrong length, out of range, unknown type, off the map) is dropped and counted; the 20th malformed frame closes 1008.
- Rate per connection: token bucket, 12 frames a second, burst 30, for all frames. SAY: 1 a second, burst 3. TO: 2 a second, burst 6. INFO: 1 every 2 s.
- Connections: 300 at most (503 on upgrade when full); 24 per client address (`CF-Connecting-IP`), 429 beyond. An IPv6 client counts by its /64 (one device owns the whole block), an IPv4-mapped IPv6 address as the IPv4 one. 24 because mobile carriers put many phones behind one address.
- When the relay is full, a newcomer still gets in if the address holding the most places holds at least two more than the newcomer does: that address's connection that never said HELLO, or else the quietest, is closed with 1013. So a few addresses cannot hold all 300 places, but 300 addresses with one place each can (nothing to take from anybody).
- Frames per client address per UTC day: 800,000. The next frame past that closes the socket (1008) and the address gets 429 on upgrade until the next day. Closed rather than ignored because every incoming frame is billed by Cloudflare whether or not it is dropped. Kept in memory only (and emptied if it ever holds 200,000 addresses).
- A connection that stays over its rate (100 frames refused in a row, a quiet spell of 10 s forgives) is closed with 1008. A text frame closes with 1003.
- No HELLO within 10 s closes the socket (1008); no frame for 60 s closes it (1001). Both are checked when the next event arrives, at most once a second.

## State and hibernation

The per connection record that must survive hibernation (handle, address, whether it said HELLO, info, last position, its set) lives in the socket attachment as a hex string, about 170 bytes at most against the 2 KiB limit. The reverse lists, thinning times, token buckets and counters are in memory and are rebuilt or reset after a wake-up: the cost is a fresh bucket and an early next state from each neighbour. The attachment is rewritten about once a second per active player (on each recompute) and when the set or info changes. `/stats` counters may reset on hibernation.

## Layout

- `src/proto.rs`: wire format, limits, frame builders, token bucket, origin check. No Worker types.
- `src/interest.rs`: the set selection with hysteresis. No Worker types.
- `src/hub.rs`: the whole state machine. It takes frames and a clock and returns actions (send, close, save attachment). No Worker types.
- `src/glue.rs`: the Worker and the Durable Object, only compiled for wasm. It moves frames between sockets and the hub.
- `test/e2e.mjs`, `test/load.mjs`, `test/lib.mjs`: Node scripts against `wrangler dev`.

## Run, test, deploy

Tools: Rust with the `wasm32-unknown-unknown` target, `worker-build` 0.9 (`cargo install worker-build`), Node 22.

```
npm install                                   # wrangler 4, dev dependency
cargo test                                    # the rules, natively (49 unit tests)
npx wrangler dev --port 8799 --ip 127.0.0.1   # builds and runs the Worker locally
node test/e2e.mjs                             # every frame, every limit, against the running Worker (about 40 s)
node test/load.mjs                            # 60 players, 5 states a second each, 20 s
```

`RELAY=http://host:port` points the scripts at another address. The end to end script sets `Origin` and `CF-Connecting-IP` itself (Node's WebSocket accepts a `headers` option, and `wrangler dev` honours the address header), so the origin check and the per address cap can be exercised locally. Run it against a fresh `wrangler dev`: it expects to be the only user.

Deploy (by the owner, from this folder): set `ORIGINS` in `wrangler.toml` to the game's origin if it differs, then `npx wrangler deploy`. The first deploy runs the `v1` migration that creates the SQLite Durable Object class.

## Not in v2

No accounts and no bot check (a Turnstile check on the upgrade can be added later without changing the frames). No persistence. No server side simulation or anti-cheat: a player can lie about its own position.
