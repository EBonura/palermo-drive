# Relay status (2 November 2026)

Multiplayer is shelved. The Rust relay is finished enough to pick up again, nothing is deployed, nothing is committed.

## State

`relay/` holds a Rust relay that replaces the Go one (the Go files are deleted). It builds with `cargo build --release` (a 2.4 MB binary on this Mac), `cargo test --release` passes (11 tests), `cargo build --release --features loadtest --bin loadtest` builds the load test, `--features metrics` adds tick timing. `relay/target/` was removed; `.gitignore` covers `target/` and `data/`.

Routes: `/ws`, `/ping`, `/stats`, `/healthz`. Protocol version 2 (see `src/protocol.rs`): 256 players per room, 40-bit positions (5 cm, about +-26 km, the map needs +-12.7 km), STATES frames with 11-byte full and 7-byte short entries, INFO carries a position anchor.

Last host decision: the owner's Mac behind a Cloudflare tunnel, plain WS on 127.0.0.1, no ACME, no cloud. The code follows that: listens on 127.0.0.1 by default, files in `-data` (default `./data`, atomic writes), client address from the socket unless `-trust-header CF-Connecting-IP` is given, monthly outbound traffic counter with `-traffic-refuse-gb 8000` and `-traffic-stop-gb 9500` (placeholders, set them to the real limit), no session limit, one thread by default.

## Done

- Everything in the first brief: routes, interest management with a spatial grid and batched per-tick fan-out, rate limits, Origin allowlist, name cleaning and filter, idle/AFK timeouts, SIGTERM shutdown, file persistence, Rust load test with the old flags plus `-mode churn|storm|stall|abuse` and `-k`.
- Per-address limit 16 (IPv6 by /64), 300 connections, header read timeout 10 s (own accept loop), bounded queues, slow readers dropped.
- Traffic work: short entries beyond 150 m, per-receiver phase for the update gaps, bands 150/80/200 m (`-bands`) chosen from an interpolation-error simulation.
- Browser checks (two headless pages, far-out and centre, near and far, a car driving): passed on the layout before the last two changes. A Node check that runs the real decode code of `src/net.js` against the live relay (five places on the map, near and far) passed on the final layout.
- Stress: churn, reconnect storm, stalled readers, malformed and flood messages (12 abuse checks), 10 minute soak. All passed.

## Not done

- `relay/RUN.md` (the run guide for the Mac) was not written. No launchd file, no tunnel notes, no CSP note.
- `docs/SECURITY.md` still describes the Cloud Run era (Dockerfile digests, X-Forwarded-For, Firestore). The relay no longer trusts X-Forwarded-For and has no Firestore or Docker.
- No browser run after the band change, the INFO anchor change, or the `src/net.js` changes for `RELAY_URL_FILE` and the quieter fallback. Those parts of `net.js` are untested.
- No re-measurement of the 255-player runs with the final code on a quiet machine; the Mac was loaded by other work throughout, so CPU figures are rough.
- Ceiling and runtime-thread comparisons were measured on an earlier build.
- The GBP cost estimator was written, tested, and then removed again when the host changed. Prices I looked up are not kept anywhere.

## Numbers (loopback, bots on the same machine, loaded Mac: treat CPU as rough)

Go baseline from the brief: 63 kB/s, 616 kB/s, 2.1 MB/s egress at sides 6000, 1500, 300 (255 players, its bots had a 2048-byte read limit that killed crowded clients).

Rust, 255 players, payload per player-minute, relay CPU (share of one core) and RSS:

| Side | First Rust build (11 B near, 11 B far) | After short entries | After band change (150/80/200) | CPU | RSS |
| --- | --- | --- | --- | --- | --- |
| 6000 | 12.7 kB | 9.9 kB | 7.2 kB | 2.3 to 4.6% | 6 MB |
| 1500 | 158 kB | 114 kB | 84 kB | 3 to 6% | 6.5 MB |
| 300 | 1.30 MB | 1.07 MB | 0.75 MB | 4 to 6% | 9.5 MB |

The band change was measured in alternating pairs with the same binary: payload -25%, -27%, -30%; the accounted bytes (payload plus 40 B a frame) -25%, -21%, -28%.

Upload needed from a home connection (payload plus 66 B a frame for TCP/IP and tunnel/TLS framing, an estimate), final code, 20 s runs:

| Players | Spread over 6 km | Bunched in 300 m |
| --- | --- | --- |
| 32 | 0.03 Mbit/s | 0.6 Mbit/s |
| 100 | 0.21 Mbit/s | 4.8 Mbit/s |
| 256 | 0.9 Mbit/s | 29 Mbit/s |

Per player-hour that is 0.4 to 1.6 MB spread and 8 to 51 MB bunched.

Tick (earlier build, noisy machine): 255 players spread 0.12 to 0.3 ms p50, bunched 0.6 to 0.8 ms p50, p99 mostly under 2 ms with scheduler spikes. About 9 to 10 microseconds per player in a crowded room. 1024 players (4 rooms of 256 bunched): p50 9.4 ms; 2048: ticks started to slip (24 in 5 s), the machine was saturated by other work. Allocation: one per frame, which a profile (sampling, 10 s) showed below the sampling floor; the time is in `sendto`/`recvfrom`.

Single core (Docker `--cpus=1`, arm64 Linux, 255 players through the VM's port forward, earlier build): 10 to 13% of the vCPU, never throttled, 4 to 5 MB; `-threads 1` equal to or better than 2, and 4 used about 10% more. The Docker image is gone with the Dockerfile.

Churn (2977 sessions in 30 s) and a 10 minute soak (22,306 sessions plus 150 steady players): RSS flat at 6 to 6.7 MB, file descriptors flat, no failed dials. Storm: 255 of 255 reconnected in each of three rounds (slowest connect 0.3 to 5 s, dominated by machine load). Stall: 50 non-reading clients added 1.6 MB, others unaffected. Abuse: all 12 checks passed.

## Files

Deleted Go files (plain `rm`): `relay/main.go`, `relay/protocol.go`, `relay/stats.go`, `relay/store.go`, `relay/go.mod`, `relay/go.sum`, `relay/loadtest/main.go` (and the empty `relay/loadtest/`).
Also deleted: `relay/deploy.sh`, `relay/Dockerfile`, `relay/.dockerignore`, `relay/DEPLOY.md` (Cloud Run era; the Dockerfile and DEPLOY.md existed in git before, `git checkout` restores the old ones).

New: `relay/Cargo.toml`, `relay/Cargo.lock`, `relay/STATUS.md`, `relay/src/main.rs`, `hub.rs`, `serve.rs`, `stats.rs`, `store.rs`, `protocol.rs`, `metrics.rs`, `relay/src/bin/loadtest.rs`.
Changed: `relay/.gitignore` (`data/`, `target/`), `src/net.js`, `docs/SECURITY.md`.
Not mine: `relay/killswitch.sh` shows as modified in git; I did not touch it. `relay/killswitch/` is unchanged. `.github/dependabot.yml` still lists the Go modules of `relay/` (not edited, should become cargo or go).

Should not go out with other releases: `src/net.js` (protocol 2, `RELAY_URL_FILE`, new fallback; inert while `RELAY_URL` is empty, but untested after the last edits) and `docs/SECURITY.md` (stale as above). Nothing in `tools/build/` was changed. When a relay goes live, `connect-src` in `tools/build/build.mjs` must name its host (it allows only `*.run.app`).


