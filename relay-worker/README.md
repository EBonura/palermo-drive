# Palermo Drive relay (Cloudflare Worker, Rust)

This Worker has two independent parts. The first, below, is Palermo Drive's room (`/r`). The second is a bus for the board game BLATERO (`/t`, "tables"): see [Tables (BLATERO)](#tables-blatero), which is also the protocol reference for that game.

Every player holds one WebSocket to this relay, sends its own state, and receives the players near it. Players never learn each other's network address. The relay simulates nothing and trusts nothing: it parses just enough of a state to know where a player is, decides who gets whom, and forwards the game's own small messages. The game keeps validating every byte it receives.

This is protocol v2. It is not the older server in `../relay/`.

## Hosting and why it is shaped this way

One Worker (Rust, `worker` crate 0.9, built with `worker-build`) and ONE Durable Object (`id_from_name("main")`, SQLite class, WebSocket Hibernation API), created with the location hint `weur` because the players are in Italy. The hint only applies when the object is first created.

The free plan allows 100,000 requests a day, with incoming WebSocket messages counted 20 to 1 (about 2 million a day), and 13,000 GB-s a day, which is about one busy object all day. It stops with errors when exceeded and never bills. Outgoing messages are free. So incoming frames are the scarce resource, nothing here uses a timer (an alarm would keep an idle object awake), and every time based rule is checked lazily when the next event arrives.

## Endpoint

`GET /r` with a WebSocket upgrade. Refused with 403 unless `Origin` is in the allowlist (the `ORIGINS` variable in `wrangler.toml`, comma separated, default `https://palermo-drive.it`). `http://localhost:<port>` and `http://127.0.0.1:<port>` are always allowed for development and tests. A request with no Origin is refused too (browsers always send one). Without an upgrade header: 426. `GET /status` is what the game asks after a failed connect (a browser cannot read why an upgrade failed): always 200 JSON, `Access-Control-Allow-Origin` for the allowed origins and localhost / 127.0.0.1 with a port, `Cache-Control: private, max-age=5`. `{"ok":true,"online":n,"max":m}`, or `{"ok":false,"why":"full"}` (all places taken), `"budget"` (the caller's address has used its frames for today), `"quota"` (the call to the object threw a message about an exceeded limit, which is what the free plan's daily limits do) or `"error"` (it threw anything else). When the Worker itself is over its daily limit Cloudflare answers instead, with no CORS headers, and the browser cannot read it. See `status.rs` and docs/ONLINE.md. `GET /stats` returns JSON counters and nothing that identifies a player. Anything else: 404.

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
- `src/status.rs`: what `/status` answers and which origins may read it. No Worker types.
- `src/glue.rs`: the Worker (the routes `/r`, `/t` and `/status`) and the `Relay` Durable Object, only compiled for wasm. It moves frames between sockets and the hub.
- `src/tproto.rs`, `src/shape.rs`, `src/tables.rs`: tables (BLATERO): frames and limits, the payload shape check, the state machine. No Worker types.
- `src/tglue.rs`: the `Tables` Durable Object, only compiled for wasm.
- `test/e2e.mjs`, `test/load.mjs`, `test/lib.mjs`: Node scripts against `wrangler dev` for the room.
- `test/tables-e2e.mjs`, `test/tables-load.mjs`, `test/tlib.mjs`: the same for tables.

## Run, test, deploy

Tools: Rust with the `wasm32-unknown-unknown` target, `worker-build` 0.9 (`cargo install worker-build`), Node 22.

```
npm install                                   # wrangler 4, dev dependency
cargo test                                    # the rules, natively (49 unit tests for the room, 59 for tables)
npx wrangler dev --port 8799 --ip 127.0.0.1   # builds and runs the Worker locally
node test/e2e.mjs                             # every frame, every limit, against the running Worker (about 40 s)
node test/load.mjs                            # 60 players, 5 states a second each, 20 s
node test/tables-e2e.mjs                      # tables: every frame, limit and close code (about 4 minutes: it waits out the idle rules)
node test/tables-load.mjs                     # tables: 20 tables of 6 sockets, 120 s of realistic traffic
```

`RELAY=http://host:port` points the scripts at another address. The end to end script sets `Origin` and `CF-Connecting-IP` itself (Node's WebSocket accepts a `headers` option, and `wrangler dev` honours the address header), so the origin check and the per address cap can be exercised locally. Run it against a fresh `wrangler dev`: it expects to be the only user.

Deploy (by the owner, from this folder): set `ORIGINS` (and `TABLE_ORIGINS`) in `wrangler.toml` to the games' origins if they differ, then `npx wrangler deploy`. The first deploy runs the `v1` migration that creates the SQLite Durable Object class `Relay`, and `v2` creates `Tables`. A deploy restarts both objects and drops every live socket (the games' clients reconnect by themselves), so do it at a quiet moment.

## Not in v2

No accounts and no bot check (a Turnstile check on the upgrade can be added later without changing the frames). No persistence. No server side simulation or anti-cheat: a player can lie about its own position.

## Tables (BLATERO)

A second kind of room for the board game BLATERO. A table is up to 8 sockets that named the same 5 character code. The relay numbers them (slots), tells each member who is there, and forwards each frame to the other members, in one order, to everyone. It never plays the game: it checks that each payload looks like one of BLATERO's four messages (below) and passes it on. It stores nothing: a table is its sockets, and it is gone with its last one. This section is the only protocol reference for the tables; BLATERO's own README points here.

### Hosting

The same Worker, a second Durable Object class `Tables` (SQLite class, but no storage is used), ONE instance for all tables (`id_from_name("main")`, location hint `weur`), added by migration `v2`. Palermo Drive's room (`Relay`) is not touched: its sockets, caps, budgets, bugs and memory are separate from the tables'. What is shared is the Cloudflare account's daily allowance (100,000 requests, 13,000 GB-s), which no code in a Worker can separate. A deploy restarts both objects.

### Endpoint and origin

`GET /t` with a WebSocket upgrade. Without the upgrade header: 426. Refused with 403 unless `Origin` is in `TABLE_ORIGINS` (comma separated; the default, and the `wrangler.toml` value, is `https://html-classic.itch.zone`) or is `http://localhost:<port>` or `http://127.0.0.1:<port>`; a missing Origin is refused. The check runs in the Worker before the object, so a refused browser never wakes it. `TABLE_ORIGINS` and `ORIGINS` are separate lists: a Palermo Drive page (`https://palermo-drive.it`) is refused on `/t`, and a BLATERO page is refused on `/r`. There is no `/stats` for tables (it would wake the object and cost a request); counters go to the log and can be read with `wrangler tail`: one line with no address and no code, when the last table closes and at most every ten minutes. Any other path: 404.

**The Origin check is weak here, and this is stated plainly.** BLATERO runs on itch.io, whose game frame is served from `https://html-classic.itch.zone`, a host shared by every HTML5 game on itch. The relay cannot tell BLATERO from any other game there, and any itch developer's page can open table sockets. As everywhere, a client outside a browser sets any Origin anyway. What limits a stranger is everything else below: the frame and payload shapes, the table and address limits, and the rates.

### Frames

The two tables below are the contract with BLATERO's client. All frames are binary, little endian, first byte the type, at most 16,384 bytes in total (header included). A text frame closes the socket (1003).

Client to relay:

| Type | Layout | Meaning |
| --- | --- | --- |
| 1 HELLO | `[1][ver u8 = 1][flags u8][pid 16][code 5]` | First frame, within 10 s, once. `flags` bit 0: the table must be new; the other bits must be 0. `pid` is the player's UUID as 16 raw bytes (v4 bits checked). `code` is 5 ASCII characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. Any other first frame, a bad or second HELLO, closes (1008). |
| 2 BCAST | `[2][kind u8][payload]` | To every other member. |
| 3 TO | `[3][slot u8][kind u8][payload]` | To one member of the same table; dropped and counted if the slot is not live (or is the sender's own). |
| 4 BEAT | `[4]` | Keepalive, every 15 s while the page is visible. |

Relay to client:

| Type | Layout | Meaning |
| --- | --- | --- |
| 1 WELCOME | `[1][ver u8 = 1][slot u8][n u8][n x ([slot u8][pid 16])]` | Your slot (0..7, the lowest free) and the roster of the others (at most 7). |
| 2 JOIN | `[2][slot u8][pid 16]` | A member arrived. Always sent before that member's first BCAST. |
| 3 LEAVE | `[3][slot u8]` | A member's socket is gone. |
| 4 BCAST | `[4][from slot u8][kind u8][payload]` | |
| 5 TO | `[5][from slot u8][kind u8][payload]` | |
| 6 BEAT | `[6]` | Answer to BEAT. The client treats 25 s of silence from the relay as a dead socket and reconnects. |

Message kinds. The payload is UTF-8 JSON: exactly one object, with exactly the top-level keys below. A payload that breaks any of this is malformed (dropped and counted; the 20th closes 1008). Types are JSON types; "object or null" means either.

| Kind | Meaning | Required keys | Optional keys | Cap |
| --- | --- | --- | --- | --- |
| 1 hello | `{version, ask?, full?}` | `version` number | `ask` boolean, `full` boolean | 512 B |
| 2 state | a whole `RoomState` | `code` string, `version` number, `phase` string, `players` array, `game` object or null | `votes` object, `ready` array, `chosen` object, `recent` array | 16 KiB |
| 3 patch | `{from, to, f, p}` | `from` number, `to` number, `f` string, `p` object or null | none | 16 KiB |
| 4 act | `{nonce, action}` | `nonce` string, `action` object | none | 1 KiB |

The keys were derived from BLATERO's `src/net/session.ts` (`Hello`, `Envelope`, `StatePatch`) and `src/room/state.ts` (`RoomState`, whose `votes`, `ready`, `chosen` and `recent` are left out of the JSON when undefined, which is why they are optional and never null) at commit `3f5406a`, with `hello` slimmed to `{version, ask?, full?}` as decided: the sender's id and name come from the roster and the state, and the old `p` protocol key is gone. A cap is on the payload, and the 16,384 byte frame limit includes the header, so the largest state is 16,382 bytes in a BCAST and 16,381 in a TO.

**Changing the top-level shape of any of these messages in BLATERO (a key added, renamed or removed, or given another JSON type) means changing `src/shape.rs` and deploying the relay first.** Until then the relay drops the new shape. Changes below the top level (what is inside `players`, `game`, `action`, `p`) do not touch the relay.

What the check does. It checks: valid UTF-8; the first byte is `{` and the last is `}`; the whole payload is well formed JSON (strict grammar: no trailing commas, no leading zeros, no single quotes, no NaN, control characters and unknown escapes refused in strings); every required key present once with its JSON type; no other top-level key; no top-level key written with an escape (a lenient parser reads `"vers\u0069on"` as `"version"`); nesting at most 32 deep; at most 4,096 tokens (values and keys) for a state or patch, 256 for an act, 32 for a hello; a number of at most 40 characters; the kind's size cap.

What it does not do. It does not look inside: values below the top level are walked to confirm the JSON is well formed and then forgotten, so it does not know what a card, a move, a phase name or a legal action is. Anyone who wants to carry other data in these shapes can: a state's `players` array can hold anything. The check makes the relay a poor general purpose bus (fixed key names, fixed types, four kinds), not an impossible one.

Why a scanner and not `serde_json`: measured as the gzip -9 size of the Worker's wasm (the three builds differ by about 100 bytes of unrelated glue), the tables as built are 188,322 bytes with the hand written scanner, 186,621 with no shape check at all (so the scanner costs about 1.6 KB), and 201,828 with a `serde_json` based check (about 15 KB more than no check). serde_json also reads a duplicate key as the last one and an escaped key as the plain one, builds the whole value in memory (a 16 KiB payload of tiny values becomes thousands of allocations), and has no token bound and only a fixed recursion limit of 128 that is not ours to set. The scanner is about 250 lines, builds nothing, and every bound is a constant in `src/shape.rs`.

### Joining, creating, identity

The table is identified by its code, which travels in HELLO and never in the URL, so it does not appear in request logs. Create and join are one frame: a returning player reopens an empty table from the state saved on their device. Flag bit 0 ("must be new") makes the relay close with 4002 if a table with that code is live, so a random collision cannot put a new host into strangers' table; the client then draws another code. The first member gets slot 0 and an empty roster; a later one gets the lowest free slot and the roster of the others, and the others get JOIN. WELCOME and JOIN are sent in the same batch, so JOIN always precedes the newcomer's first BCAST.

The relay binds each socket to the `pid` of its HELLO. A HELLO with a pid already live at that table (the same player on a newer socket) replaces the older socket: it is closed with 4001, the others see LEAVE and then JOIN, and the newcomer takes the freed slot. The same pid at two different tables is allowed. The relay does not know who is host and does not interpret the game; each forwarded frame carries the sender's slot, which the client maps to a pid through the roster.

### Order and delivery

One object handles events one at a time and sends in the same order to every receiver, and TCP keeps each socket's order, so all members see the same order of JOIN, LEAVE and frames. Delivery is best effort while the socket lives: a frame sent while a member's socket is down is not replayed; there are no duplicates and no echo to the sender. There is no log. A newcomer is caught up by the members, who each send it a hello and their state with TO when they see its JOIN; the game keeps the highest version, and its own resends cover any gap.

### Close codes

| Code | When |
| --- | --- |
| 1001 | A member silent for 40 s |
| 1003 | A text frame |
| 1008 | Policy: a bad or second HELLO, a first frame that is not HELLO, no HELLO in 10 s, 20 malformed frames, a flood (100 refused frames in a row), the daily budget, a 5th table or a 9th distinct code for one address |
| 1009 | A frame over 16,384 bytes |
| 1013 | The relay is full (a 31st table), or the socket was closed to make room for a newcomer (below) |
| 4001 | Replaced by a newer socket of the same pid |
| 4002 | The table already exists and HELLO asked for a new one |
| 4003 | The table was closed for idleness |
| 4004 | The table has 8 sockets |

The client's reactions: 1013 and 1001 retry with backoff; 4002 draws a new code; 4001 and 4003 stop retrying until a user action or the page returns to the foreground.

### Limits

Over a limit means dropped and counted, unless a close or a status is stated. Cloudflare bills every incoming frame whether or not the relay drops it, so floods are closed and not just dropped.

- Frame: 16,384 bytes in all (1009 beyond). Malformed (unknown type or kind, bad slot, bad UTF-8, over the kind's cap, a payload that fails the shape check): dropped and counted; the 20th closes 1008.
- Per socket: 8 frames a second, burst 24; 32 KB a second, burst 64 KB (a frame is charged its bytes). 100 refused frames in a row (a quiet spell of 10 s forgives) closes 1008.
- Per table: 40 frames a second, burst 120, for BCAST and TO (beats are not counted). Frames over it are dropped and counted, and the sender is not struck: one noisy member must not get the quiet ones closed.
- Sockets: 8 per table, 180 in all (503 on upgrade when full), 24 per address (`CF-Connecting-IP`; an IPv6 client counts by its /64, an IPv4-mapped one as the IPv4 one; 429 beyond), 4 tables per address.
- When the relay is full, a newcomer still gets in if the address holding the most places holds at least two more than the newcomer does: that address's socket that never said HELLO, else its quietest, is closed with 1013. So a few addresses cannot hold all 180 places.
- Tables: 30 at once (a 31st is closed 1013 at its HELLO). 8 distinct codes per address per hour (the 9th is closed 1008 at its HELLO), counted from the HELLO whatever its outcome, so this is also the limit on guessing; naming a code the address already named costs nothing. These two are decided at HELLO and not on the upgrade, because the code travels in the first frame, so they close with 1013 or 1008 and cannot answer 429.
- Frames per address per UTC day: 100,000 (a six phone table at one address for four hours is about 8,000). The next frame past it closes the socket (1008) and the address gets 429 on upgrade until the next UTC day.
- Timers, all lazy (checked when the next event arrives, at most once a second; no alarm, because an alarm would keep an idle object awake): no HELLO within 10 s closes (1008); a member silent for 40 s (beats come every 15 s) closes (1001); a table with no HELLO, BCAST or TO for 30 minutes is closed (4003 to every member), which stops an abandoned open tab from keeping the object awake all night. Because nothing runs between events, an idle object keeps a dead socket's place until some other event arrives.

### What survives hibernation

Each socket's attachment, a hex string of about 90 characters against the 2 KiB limit, holds: handle, address (the /64 for IPv6), connected time, and, once it said HELLO, its table code, slot and pid. The tables are rebuilt from the attachments on the first event after a wake-up (two attachments claiming one slot or one pid at a table: the later is closed 1011). Reset on a wake-up: the token buckets, the per address hour and day counters, the table idle clock and the counters. At worst an idle player gets fresh buckets and a fresh idle timer, and an address that was over a count starts again. Never kept: names (the relay never sees them), game state, any frame.

### What the relay refuses

No Origin or a wrong one. No HELLO in 10 s, a second HELLO, any first frame that is not HELLO. A code that is not 5 characters of the game's alphabet, or a pid that is not a v4 UUID (no arbitrary channel names). A kind other than 1 to 4, a payload over its cap or whose top level is not exactly its kind's shape. A TO to a slot that is not live at the same table; no cross table frame, no listing of tables or members, no directory. A 9th socket in a table, a 31st table, more tables or codes per address than the limits. Text frames. No persistence and no history: a table dies with its last socket.

A determined person can still run 8 scripted sockets in a table of their own, with BLATERO shaped JSON, as a private channel. That is as far as "not a bus" can honestly go without accounts.
