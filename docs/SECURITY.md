# Security audit (board item r6)

Scope: the repository (files, git history, ignore rules, CI, dependencies, CDN use), the game as it runs in a browser (untrusted text and URL parameters reaching the page, saved
data, what the public GitHub Pages site serves) and the multiplayer relay in `relay/` (not deployed yet). Method: read-mostly. Everything below was checked by running a command or
reading the line quoted; nothing was assumed. Small, clear fixes were made and are marked **Fixed**; everything else is **Open** with what to do.

Severity: **High** (exploitable now, real harm), **Medium** (exploitable with some effort or only once something is deployed), **Low** (hardening, privacy, hygiene), **Info** (checked, fine, or a note).

The repository is public (`github.com/EBonura/palermo-drive`, 173 commits, one author identity: the GitHub noreply address), and Pages serves the built `dist/` at `https://ebonura.github.io/palermo-drive/`.

## Summary

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| 1 | Secrets, tokens and keys in files and in the whole git history | none found | Info |
| 2 | Work e-mail address in `tools/context.py` (and so in history) | Low | Fixed in HEAD, history keeps it |
| 3 | Workflow gave `pages: write` and `id-token: write` to the build job; actions pinned by moving tag | Low | Fixed |
| 4 | `?relay=` made the game talk to any server named in a link | Medium (once the relay is live) | Fixed |
| 5 | `?photomap=` made the game load pictures and a map from any server named in a link | Low | Fixed |
| 6 | `?worldurl=` makes the game load world data from any server named in a link | Medium | **Fixed** (`src/world.js`: this site or localhost only) |
| 7 | `assets/ui/cover.html?mode=` was reflected into `innerHTML` | Medium (but the page is not published) | Fixed |
| 8 | No Content-Security-Policy on the published page | Low (defence in depth) | Fixed (meta tag in the build) |
| 9 | `.gitignore` had no rule for key files, env files or logs | Low | Fixed |
| 10 | `tools/autopush.sh` commits and pushes everything to the public repo with no secret check | Medium | Fixed (guard added) |
| 11 | Saved driver picture was taken from localStorage as any address | Low | Fixed |
| 12 | GitHub-side settings: Dependabot, secret scanning, push protection and private reporting were off or unknown; no branch protection | Medium | **Fixed** by the owner on 2026-11-02 and read back with `gh api`: Dependabot alerts and security updates, secret scanning, push protection and private vulnerability reporting are on. `main` stays unprotected on purpose (autopush). |
| 13 | Relay server: stats key in the URL query, base images need a bump process, `X-Forwarded-For` trusted as sent (the Go 1.22 finding is closed: the relay is Rust now) | Low | **Open** (see section 12) |
| 14 | HTML injection through OSM names, credits, URL parameters and saved data | none found (one shared `esc()` now) | Info |
| 15 | Third-party scripts and CDN: pinned, but without Subresource Integrity, in the dev tree only | Low | Open (Info) |
| 16 | Build dependencies | `npm audit`: 0 vulnerabilities | Info |

## Repository

### 1. Secrets in files and in history (Info, nothing found)

- The Mapillary token lives in `data/mapillary_token` (54 bytes). `data/` is in `.gitignore` (line 2). The path was never committed: `git log --all --name-only` lists nothing under `data/`,
  and `git log --all -S'MLY|'` finds no commit that ever contained the token's prefix. The token appears in no tracked file (`docs/sources/mapillary.md` only says where it is kept), and no tool in
  `tools/` reads or prints it. Its file mode was 644; set to 600 (a local change, not tracked).
- Key-shaped strings in the whole history (`git log --all -G` over everything except `world/`, `docs/perf` and `assets/peds`): AWS access keys, GitHub tokens (`ghp_`, `gho_`, `github_pat_`),
  OpenAI-style `sk-`, Slack, Google API keys, private-key blocks, Mapillary `MLY|`. No match. Also nothing named `.env`, `*.pem`, `*.key`, `*credentials*`, `*token*` was ever tracked.
- Working tree: grep for `key|secret|token|password|bearer|authorization` over tracked text files matches only prose and code that mentions such words (game "secret" achievements, the relay's
  rate-limit "tokens", `STATS_KEY` as a variable name in `relay/deploy.sh`, which generates it with `openssl rand`). No value.
- Images: the nine facade photographs and the `docs/districts` pictures carry no EXIF (no GPS, no camera data). Their sources and licences are in `assets/facades/photo/map.json` and the CREDITS files.
- The friends' reference photos are in `data/npc-refs` (ignored). The tracked sprites (`assets/peds/lpc/garage.*`, `docs/previews/friends-sprites*.png`) are pixel-art characters, not photographs.

### 2. Work e-mail address in a public personal repository (Low, Fixed in HEAD)

`tools/context.py` line 33 sent `contact ebonura@fastly.com` in the User-Agent of its Overpass requests. It now says `contact https://github.com/EBonura/palermo-drive`. The old address stays in
the history (commits that touched that line). Rewriting history of a repository with Pages and 173 commits is not worth it for an address that is already on a work profile; if you want it gone anyway,
that needs `git filter-repo` and a force push. The personal Google account `bonniestudiosdev@gmail.com` is named in `relay/DEPLOY.md`, `deploy.sh` and `docs/TODO.md` as the deployment account: public
on purpose, but it is also the login name of that account, so enable two-step verification on it.

### 3. `.gitignore` coverage (Low, Fixed)

What it really covered: `data/`, `dist/`, `node_modules/`, `tools/build/.cache/`, `tools/.venv/`, `__pycache__/`, `.claude/`, `.DS_Store`, `*.orig`, `*.tmp.js`, `*.tmp.mjs`. `world/` is **not**
ignored (the tiles are tracked and published; `docs/PERF.md` said otherwise; corrected). Nothing for key files, env files or logs, so a stray `.env` or `*.pem` would have been
committed by `git add -A` (see the autopush finding). Added: `.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.keystore`, `*credentials*`, `*.token`, `*_token`, `*.secret`, `secrets.json`, `*.log` (narrow on purpose:
the game has a feature called secrets, and `src/secrets.js` must not vanish silently). `data/autopush.log` was already covered by `data/`.

### 4. GitHub Actions (Low, Fixed; settings Open)

`.github/workflows/pages.yml`, triggers `push` to `main` and `workflow_dispatch` only (no `pull_request_target`, no secrets used, no third-party actions: all four are `actions/*`).
- Before: one top-level `permissions` block gave `pages: write` and `id-token: write` to both jobs, so the job that runs `npm ci` and the build had a token that could publish. Now
  `permissions: {}` at the top, `contents: read` for the build job, `pages: write` and `id-token: write` for the deploy job only.
- Before: `actions/checkout@v7`, `setup-node@v7`, `upload-pages-artifact@v5`, `deploy-pages@v5` (moving tags). Now pinned to the commit each tag pointed at on 2 November 2026 with the tag in a
  comment (`3d3c42e5…` checkout, `949feb24…` setup-node, `fc324d35…` upload-pages-artifact, `368f8252…` deploy-pages; checked against `gh api repos/<action>/git/ref/tags/<tag>`).
- `npm ci --no-audit --no-fund` installs from the lockfile (good); `--no-audit` only skips the audit message.
- Added `.github/dependabot.yml` (monthly: Actions, `tools/build` npm, `server` Go modules; the relay is Rust now, so the `server` entry must become `cargo`) so the pins get bumped. It only works once Dependabot is switched on (see the repository settings finding).

### 5. Build dependencies (Info)

`tools/build/package.json`: `esbuild 0.28.2`, `puppeteer-core 25.16.0`, `sharp 0.35.5`, `three 0.187.0`, all exact versions, all `devDependencies`, `private: true`. `package-lock.json` has 85 packages, all from
`registry.npmjs.org`, all with integrity hashes. `npm audit`: found 0 vulnerabilities. The only install script is esbuild's (it fetches its platform binary). `tools/build/serve.mjs` (test server) listens on
127.0.0.1 only; its path check is `file.startsWith(base)`, which also accepts a sibling directory with the same prefix (Info: local tool, never exposed).
Not covered by the lockfile: `relay/killswitch/package.json` (`^5.0.0`, `^3.0.0`, no lockfile; a Cloud Function you deploy once), and the Python tools (no requirements file). Neither ships to players.

### 6. Third-party scripts and CDN imports (Low, Info)

- `index.html` (the development tree) maps `three` to `cdn.jsdelivr.net/npm/three@0.187.0/...`: an exact version, so the content does not drift, but there is no Subresource Integrity (an import map can
  carry `integrity` in current Chrome). `assets/ui/cover.html` (source of the share images, not published) does the same.
- The **published** page does not use the CDN: `tools/build` bundles three and the addons into `js/app.<hash>.js`. A built page makes no request to any other host (checked: zero external requests on
  title, play, Garage and a race). Fonts are self-hosted (`assets/ui/fonts`). The bundle's only external strings are Wikimedia, OpenStreetMap and w3.org URLs in credits text.
- No third-party analytics, no ads, no service worker, no cookies, no `postMessage`, no `window.open`. The one thing the page can send to a server of ours is the play log (`src/playlog.js`, service in `joinlog/`): anonymous counts about play and performance, the chosen name for online players, no address, no lasting id, a switch in Options. It is off, and the page makes no such request, while `src/playlog-url.js` is empty (it is empty until the service is deployed).

## Game

### 7. Untrusted text reaching the page as HTML (Info, nothing exploitable found)

All 39 uses of `innerHTML`, `insertAdjacentHTML`, `outerHTML`, `document.write`, `eval`, `new Function` and `srcdoc` in `src/`, `assets/` and `index.html` were read. Sources of untrusted text and what
happens to them:
- **OSM names** (streets, places, venues; `world/` tiles, `palermo-data.js`): shown with `textContent` (HUD street and landmark labels, `startmap.js` popup lines 366 and 367, the radio card) or through `esc()` in template
  strings (`ui.js:633` start list, `event-fares.js:165`, `event-food.js:146`, `event-pubs.js:105`, `achievements.js:86`, `garage-ui.js`). Canvas text (minimap, name tags) is not HTML.
- **Credits converter** (`ui.js` 190 to 235, reads `assets/**/CREDITS.md`, whose authors and file titles come from Wikimedia and from LPC): `inline()` escapes first and only then builds links, and a link must
  start with `http:` or `https:` (no `javascript:`), is wrapped in `target="_blank" rel="noopener"`, and `urlLabel()` strips `<>"`. A `"` in a title cannot leave an attribute.
- **Other players' names** (relay, when deployed): drawn into a canvas texture (`net.js` `tagTexture`), never as HTML; the server also sanitises them (16 runes, no controls or format characters, `relay/src/protocol.rs`).
- **URL parameters**: values that reach the DOM are whitelisted (`lang`, `ui`, `view`, `veh`, `liv` against known ids), numeric (`peds`, `speed`, `at`, `time`, `tt`, `rs`, `cash`) or cut (`name`, 16 characters, set with `textContent`).
- **localStorage** (`palermoDrive.settings.v1`, `.net.v1`, `.pid.v1`, `.events.v1`, `.secrets.v1`, `.mapEvents`, `.a2hs`, `.keyhint`, `pd.driver`, the Garage save): every loader validates types and ranges before use
  (`ui.js` 185 to 260, `garage.js` 156 to 170, `driver.js` `cleanSpec`, `missions.js:487`, the pid must match `^[0-9a-f]{16,40}$`). A tampered save needs the page's own origin, so it is self-inflicted at worst.
- `esc()` used to be nine copies that escaped `& < > "` but not `'`. It is now one helper, `src/esc.js`, imported by `ui.js`, `garage-ui.js`, `startmap.js`, `event-hud.js`, `event-fares.js`, `event-food.js`, `event-pubs.js`, `achievements.js` and `net.js`; it also escapes `'` (as `&#39;`), so a value is safe in a single-quoted attribute too. No template used one, so nothing changed for players. Fixed.

### 8. URL parameters that load things from elsewhere

- **`?relay=wss://host/ws`** (`net.js`). Medium once the relay is live, because a link could send the player's name, position and anonymous id to any server and show that server's "players". **Fixed**: honoured on
  localhost only; `?relay=off` still works everywhere. `RELAY_URL` is empty today, so on the public site multiplayer is off and nothing connects.
- **`?photomap=`** (`buildings.js:1410`): a map file naming pictures to draw on facades. **Fixed**: used only when it is on the same origin (a test link may still name another file of the site).
- **`?worldurl=`** (`src/world.js:52` `base: Q.get('worldurl') || 'world/',` and the user at line 234 `const url = p => new URL(CFG.base + p, document.baseURI).href;`). **Fixed** (Medium before). A link
  `…/palermo-drive/?worldurl=https://attacker.example/world/` makes the game fetch the manifest and every tile from the attacker. The data is JSON (no script runs, names go through the safe paths above), so
  the damage is misleading content and memory or CPU abuse (an enormous tile), not code execution. Fixed in `src/world.js` with this change on the `base` line:
  `base: (() => { const w = Q.get('worldurl'); try { const u = new URL(w, location.href); return w && (u.origin === location.origin || /^(localhost|127\.0\.0\.1)$/.test(u.hostname)) ? w : 'world/'; } catch (e) { return 'world/'; } })(),`
  (same site or a local server, for the dev workflow).
- `src/vehicle.js` and `src/vehicle-sphere.js`: read; no network, storage or HTML use, nothing to list.
- **`assets/ui/cover.html?mode=`** was written into `innerHTML` (`<img src="cover-src/bg-${mode}.jpg">`, `className = mode`): `?mode=x"onerror="…` was a DOM XSS. The build skips `*.html` under `assets/`, so it is not on the
  Pages site (checked in `dist/`), but it runs from the dev server. **Fixed**: `mode` is one of `landscape`, `portrait`, `logo`.
- **`?debug`** exposes `window.game`, `window.__missions` and friends, and `?cash=`, `?own=all`, `?fakeprogress`, `?event=` change the player's own game. This is single-player and nothing is verified server-side, so
  it is cheating at worst (Info). The relay only relays positions.
- **`src/driver.js`** (the saved driver): the saved picture was loaded with `img.src = s.png` for any string. **Fixed** (Low): only `data:image/png;base64,` is accepted.

### 9. What the public Pages site exposes (Info, one fix)

The artifact is `dist/` only (about 92 MB: 1,124 `.bin` data and tile files, 109 PNG, music, fonts, the bundle). Not published: `src/`, `tools/`, `docs/`, `relay/`, `data/`, source maps, shell, Python, `.mjs`, logs. It does contain four `CREDITS.md`
files, `js/app.*.js.LEGAL.txt` (licence texts of the bundled libraries), `version.json` (a release id), and the whole world: OSM-derived tiles (ODbL, attributed in the game's credits). The page sets no cookies. localStorage holds
the keys listed under the HTML-injection finding plus `palermoDrive.pid.v1` (a random id, written only when the relay is configured).
GitHub Pages sends no custom headers, so there is no CSP, `X-Content-Type-Options` or frame protection from the server (`frame-ancestors` cannot be set from a `<meta>`; the game can be framed by anyone, which only matters for clickjacking, and
there is nothing sensitive to click).
**Fixed (Low, defence in depth):** `tools/build/build.mjs` now writes a `Content-Security-Policy` meta tag and a referrer policy into the built `index.html`:
`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; worker-src 'self'`.
The built site has one external script reference (its own bundle), no inline script and no `eval`, so a strict script policy fits. Tested on the built site under that policy: title screen, driving, the Garage, a race event and the credits raise no
violation. `?relay=wss://evil.example` on a non-local host makes no request; on a local host the policy blocks it anyway. If a feature starts loading something from another host (for example the relay, if it comes back),
widen `connect-src` in that one line of `build.mjs`.

### 10. `tools/autopush.sh` (Medium, Fixed)

It runs every two minutes, and after a headless smoke test does `git add -A`, commits and pushes to the public `main`. Nothing between a stray secret file and the internet except `.gitignore`. Now, after `git add -A`, it refuses and unstages
(`git reset`) when a staged file name looks like a key file (`.env*`, `*.pem`, `*.key`, `*.p12`, `*.keystore`, `*.token`, `*.secret`, `*_token`, `*credentials*`) or the staged diff (outside `world/`, `docs/perf`, `assets/`) adds a key-shaped
string (AWS, GitHub, `sk-`, Google, `MLY|`, private-key blocks); it prints `NOT pushed`. Tested in a scratch repository (both guards fire).

## Multiplayer presence (4 Nov, `src/p2p/presence.js`)

New untrusted input: the city-wide list of who is online, read from public Nostr relays. Checked: every event field by field (kind, author as 64 hex characters, topic tag, expiration inside 25 minutes, the room list against a strict pattern of three small integers per room, at most 6 rooms and 120 characters, an empty content is a goodbye), duplicate event ids dropped, at most 400 players remembered, newer replaces older per author. Signatures are not checked by the client (the relay does); a malicious relay or a crowd of fake keys can forge entries, which can only make a client join a room that turns out empty. That costs a room join, and such a room is left after 25 s and ignored for 2 minutes; the number of players held is capped whatever the list says (`MAX_PLAYERS`, with shards of at most 9 members). Rooms are only ever joined by name built from the list's integers, never by a string from it.

What leaks (see also docs/P2P-MULTIPLAYER.md, "Who can learn what"): anyone can read which 500 m cells are occupied and which cells each online player holds, under a random per-visit key, with no name and no IP. A relay that ignores the expiration tag keeps those events. It uses its own WebSockets (two relays out of the three in `PRESENCE_RELAYS`), all inside the existing Content-Security-Policy because they are a subset of `RELAYS`. Nothing opens before the yes on the name card; going solo closes them, as does a page paused or in the background for 60 s. Peer IP addresses are never displayed, logged or sent anywhere by the game.

## GitHub settings and the relay (Open)

### 11. Repository settings (Medium, owner)

Read with `gh api` (some are hidden without admin scope): Dependabot alerts are **disabled** (HTTP 403 "disabled for this repository"); `security_and_analysis` is not visible (secret scanning and push protection may be off); `main` has **no branch
protection** (404; autopush pushes straight to it, so protection would block the workflow you use: leave it, but know it); no topics, no security policy file. Recommended, all free for a public repository: Settings, Code security: enable Dependabot alerts,
Dependabot security updates, secret scanning and push protection, and private vulnerability reporting; Settings, Actions, General: workflow permissions "read repository contents" by default. Pages: HTTPS is enforced (checked).

### 12. The relay in `relay/` (Low now, Medium when deployed)

The relay was ported from Go to Rust on 2 November 2026 (`relay/src/`, tokio, axum for the routes and the WebSocket upgrade, hyper for the connection loop). Read and exercised on a local run (load, abuse and stall tests), not deployed. Good: WebSocket origin allow-list (`ebonura.github.io`, `localhost:*`, `127.0.0.1:*`; a request
without an Origin header, which is not a browser, passes), 80-byte message limit enforced by the WebSocket layer, name sanitiser (control, format and private-use characters stripped, 16 characters, tiny slur list), per-IP ping bucket (30 per minute, 40 new ids a day), `/ping` body capped at 128 bytes, HTML stats page escaped,
stats key compared in constant time, distroless non-root image, at most one instance, a monthly free-tier cap (instance time, requests and egress, the last one also outside North America) that closes the WebSocket door, and a billing kill-switch function. Added or checked in the port:
- Header read timeout of 10 s on every connection (a client that sends half a request is cut; `axum::serve` has none, so the relay runs its own accept loop), and a cap on open sockets (2 x the WebSocket cap + 256).
- Connections per address: 16 (it was 6), and an IPv6 client counts by its /64, because one device can use any address in its /64 and a per-address limit would not limit it. Total WebSockets: 300.
- Every queue is bounded: 32 frames per connection, a client that cannot take frames for 200 sends in a row (20 s) or 5 s inside one write is disconnected. A burst of other players' names waits for the next tick instead of filling the queue.
- Abuse run (`loadtest -mode abuse`): a bad Origin gets 403; a 200 byte message and a 1 MB frame close the connection; unknown-type and state floods are closed with 1008 after the strike limit; invalid UTF-8, 64 byte, control-character and block-listed names are cleaned or replaced; no INFO within 10 s is closed; the idle, AFK (4001) and per-address (429) limits fire; a half-sent request is closed at 10 s.
Open:
- `X-Forwarded-For` is trusted as sent: the last element is the client address and the per-address limit uses it. Behind Cloud Run the Google front end appends the real address there, so that is right. Run the relay directly on the internet (or behind a proxy that does not set the header) and a client can pick its own address and walk around the limit. Same as the Go version; the fix is a flag that says "behind a proxy" and ignores the header otherwise.
- The `Dockerfile` pins `rust:1-alpine` and `gcr.io/distroless/static-debian12:nonroot` by digest (resolved 2 November 2026). They go stale unless something bumps them: add the docker ecosystem to `.github/dependabot.yml`. `Cargo.lock` is committed and the build uses `--locked`. `cargo audit` was not run (not installed here).
- `/stats?key=…` puts the key in the URL (Cloud Run request logs, browser history). Accept it from an `Authorization` header instead, or rotate after each use.
- `ALLOWED_ORIGINS` in `deploy.sh` always appends `localhost:*,127.0.0.1:*`: fine for a toy, drop it for production (the Origin header is only a browser-side control anyway).
- `--allow-unauthenticated` is the point of a public relay; the cost control is `--max-instances=1`, the app's own cap and the kill-switch, which reacts to a budget notification after the spend (billing alerts lag by hours). Keep the budget at a figure you can lose.
- `relay/killswitch/` has `^` version ranges and no lockfile; add `package-lock.json` before deploying it.

## What changed in this audit (files)

`.github/workflows/pages.yml`, `.github/dependabot.yml` (new), `.gitignore`, `tools/autopush.sh`, `tools/build/build.mjs` (CSP and referrer meta), `tools/context.py` (User-Agent), `src/net.js` (`?relay=`), `src/buildings.js` (`?photomap=`),
`src/driver.js` (saved picture), `assets/ui/cover.html` (`?mode=`), `docs/SECURITY.md` (this file). Not touched, listed above with lines: `src/world.js` 52 and 234. Local only: `data/mapillary_token` set to mode 600.
