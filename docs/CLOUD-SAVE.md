# Cloud save

Your progress follows you. The first time the game runs, the browser makes a random secret code and keeps it. From then on the game uploads its saved progress by itself, a few seconds after something changes and when the page goes away. There is nothing to sign up for. The same code typed in Options (Altro, Salvataggio cloud) on another device, or after the browser's data was cleared, brings the save back.

## What is saved

The raw text of these localStorage entries, as one JSON (`src/cloud-save.js`, `KEYS`): the Garage (`palermoDrive.garage.v1`: vehicles, parts, liveries, money), the missions and events (`palermoDrive.events.v1`), the secrets (`palermoDrive.secrets.v1`), the SUCA tags, the stadium best, the options (`palermoDrive.settings.v1`) and the name (only the name of `palermoDrive.net.v1`, online or offline stays the device's own choice). The driver is saved too: its settings in the blob, its picture (a PNG data URL, the one large thing) on its own and only when it changed. Not saved: the device measurements (graphics level, benchmark), the recording, the hints that were shown.

Restoring writes those texts back and reloads the page, so every module reads its own save the way it always has. No module needs to know about the cloud.

## The code

26 characters of Crockford base32 (128 bits of randomness), shown in groups of five. Typing is forgiving: lower case, dashes, spaces, and I, L, O read as 1, 1, 0. The code is the only way back: there is no email, no password, no account. A player who clears the browser's data without having noted the code loses the save. That is the price of having no accounts, and the Options text says so.

## The server

`relay-worker/src/save.rs` (the rules, tested natively) and `sglue.rs` (the Cloudflare side). Four POST routes with a text/plain body, so the browser sends them with no preflight and the code never travels in a URL: `/save`, `/save/driver`, `/save/get`, `/save/delete`. Only the game's origin (and localhost for tests) is answered.

One Durable Object per player, named by the SHA-256 of the code (so the server never stores a code and the data cannot be found without it), made in the EU jurisdiction like the room (`JURISDICTION` in `wrangler.toml`). One small object per player means no object is hot and one player's data is one unit that can be deleted whole. It stores the blob, the driver picture, the wallet and the time of the last write.

- **Size:** the blob at most 100 000 bytes, the driver picture at most 150 000. A page saves on events, not in a loop: at most one write per 4 s per player.
- **The wallet** is sent beside the blob and checked: never above 10 000 000, and a new value may exceed the stored one by at most 5 000 plus 25 for every second since the last write; a first save may start with at most 20 000. These numbers are loose on purpose (the game pays about a euro a second for hits and a few hundred for a job, `src/economy.js`). It is a sanity check, not security: anyone can edit their own browser's storage, this only keeps an absurd wallet from being stored and carried to the next device. Constants in `save.rs`.
- **Retention:** every write sets the object's alarm one year ahead (`RETENTION_MS`); when it fires, the object deletes everything it holds. A save nobody touches for a year is gone.
- **Delete now:** Options has "Cancella dal server". It deletes the object's data and alarm, turns uploading off on that device and makes a new code, so the old one finds nothing. "Riattiva" turns it back on.

Free plan: a Durable Object request counts against the Worker's 100 000 requests a day, like the room's. One save is one request per write, and the page writes at most once every 12 s while something changes, so a busy day of play is a few hundred requests per player at most. (Free plan limits are from the Cloudflare docs as remembered when this was written: check them before counting on a number.)

## Conflicts

The device that plays writes. Entering a code on a device that already has progress compares a rough score of both (what is owned, the events done, the secrets, the tags, the money): if this device is ahead, the player is asked before it is replaced, so nothing is lost by a mistyped code or a stale save. A device with no progress takes the cloud save at once.

## Privacy

A save is gameplay data under a random code, with the chosen name inside it. The Options text and a one-time toast say so, and Options has the delete button. The page makes the first upload after 20 s of play. `?cloud=off` keeps a page from uploading (tests). The page's Content-Security-Policy already allows the relay's https origin.

## Tests

`cargo test --lib save` (in `relay-worker/`): the SHA-256 vectors, keys, writes, drivers and the wallet rule. `node relay-worker/test/save-e2e.mjs` against `wrangler dev` (`npx wrangler dev --port 8799 --ip 127.0.0.1 --var JURISDICTION:`): the routes end to end, including the refusals. In the game, `?relay=ws://127.0.0.1:8799/r` on a local page points the saving at it.
