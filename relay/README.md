# Palermo Drive relay

The multiplayer and stats server for [Palermo Drive](https://ebonura.github.io/palermo-drive/), in Rust. It forwards each player's position to the players near them, up to 256 in a room, and counts anonymous play statistics. It simulates nothing: the game runs in the browser.

Multiplayer is shelved for now, so this relay is not deployed and the game does not connect to it. [STATUS.md](STATUS.md) has where it stands, the measurements, and what is left before it can be switched on.

```sh
cargo run --release --bin relay -- -h          # options
cargo test --release
cargo run --release --features loadtest --bin loadtest -- -h
```

It listens on 127.0.0.1 and speaks plain WebSocket, so it needs a tunnel or a reverse proxy in front of it for TLS. The wire protocol is documented in [src/protocol.rs](src/protocol.rs), and the game's side of it is `src/net.js`.

`killswitch/` and `killswitch.sh` are a Google Cloud budget kill switch: a budget alert detaches billing from one project.

This folder is under the MIT licence, see [LICENSE](LICENSE). It covers the relay only, not the rest of the game.
