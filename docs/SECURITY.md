# Security audit (board item r6)

Scope: the repository (files, git history, ignore rules, CI, dependencies, CDN use), the game as it runs in a browser (untrusted text and URL parameters reaching the page, saved
data, what the public GitHub Pages site serves) and the multiplayer relay in `relay/` (not deployed, and since 20 November no longer the game's relay: see "Online multiplayer" below). Method: read-mostly. Everything below was checked by running a command or
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

`tools/context.py` line 33 used to send a personal contact address in the User-Agent of its Overpass requests. It now says `contact https://github.com/EBonura/palermo-drive`, and on 19 November 2026 the history was rewritten so that the old address is in no commit of `main`.

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
- No third-party analytics, no ads, no service worker, no cookies, no `postMessage`, no `window.open`. The things the page can send to a server of ours are the play log (`src/playlog.js`, service in `joinlog/`) and, since 23 Nov 2026, the cloud save (`src/cloud-save.js`, `docs/CLOUD-SAVE.md`: the player's own saved progress under a random code, to the game's relay, deletable from Options). The play log: anonymous counts about play and performance, the chosen name for online players, no address, no lasting id, a switch in Options. It is off, and the page makes no such request, while `src/playlog-url.js` is empty (it is empty until the service is deployed).

## Game

### 7. Untrusted text reaching the page as HTML (Info, nothing exploitable found)

All 39 uses of `innerHTML`, `insertAdjacentHTML`, `outerHTML`, `document.write`, `eval`, `new Function` and `srcdoc` in `src/`, `assets/` and `index.html` were read. Sources of untrusted text and what
happens to them:
- **OSM names** (streets, places, venues; `world/` tiles, `palermo-data.js`): shown with `textContent` (HUD street and landmark labels, `startmap.js` popup lines 366 and 367, the radio card) or through `esc()` in template
  strings (`ui.js:633` start list, `event-fares.js:165`, `event-food.js:146`, `event-pubs.js:105`, `achievements.js:86`, `garage-ui.js`). Canvas text (minimap, name tags) is not HTML.
- **Credits converter** (`ui.js` 190 to 235, reads `assets/**/CREDITS.md`, whose authors and file titles come from Wikimedia and from LPC): `inline()` escapes first and only then builds links, and a link must
  start with `http:` or `https:` (no `javascript:`), is wrapped in `target="_blank" rel="noopener"`, and `urlLabel()` strips `<>"`. A `"` in a title cannot leave an attribute.
- **Other players' names** (online multiplayer): reduced to plain text by `src/online/wire.js` (16 characters, no control, format or direction characters) and drawn into a canvas texture (`src/remotes.js`), never as HTML.
- **URL parameters**: values that reach the DOM are whitelisted (`lang`, `ui`, `view`, `veh`, `liv` against known ids), numeric (`peds`, `speed`, `at`, `time`, `tt`, `rs`, `cash`) or cut (`name`, 16 characters, set with `textContent`).
- **localStorage** (`palermoDrive.settings.v1`, `.net.v1`, `.pid.v1`, `.events.v1`, `.secrets.v1`, `.mapEvents`, `.a2hs`, `.keyhint`, `pd.driver`, the Garage save): every loader validates types and ranges before use
  (`ui.js` 185 to 260, `garage.js` 156 to 170, `driver.js` `cleanSpec`, `missions.js:487`, the pid must match `^[0-9a-f]{16,40}$`). A tampered save needs the page's own origin, so it is self-inflicted at worst.
- `esc()` used to be nine copies that escaped `& < > "` but not `'`. It is now one helper, `src/esc.js`, imported by `ui.js`, `garage-ui.js`, `startmap.js`, `event-hud.js`, `event-fares.js`, `event-food.js`, `event-pubs.js`, `achievements.js` and `net.js`; it also escapes `'` (as `&#39;`), so a value is safe in a single-quoted attribute too. No template used one, so nothing changed for players. Fixed.

### 8. URL parameters that load things from elsewhere

- **`?relay=wss://host/r`** (`src/online/online.js`). Medium once the relay is live, because a link could send the player's name and position to any server and show that server's "players". **Fixed**: honoured only when the page itself is served from localhost or 127.0.0.1, and the page policy would refuse another host anyway. `RELAY_URL` (`src/online/relay-url.js`) is the only address on the public site.
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

## Online multiplayer (20 Nov, `src/online/`)

This replaces the audit of the Nostr presence list and of the peer to peer client (4 Nov): the game no longer has either. Players hold one WebSocket to the game's relay (`relay-worker/`, a Cloudflare Worker) and nothing else; there is no WebRTC, no Nostr relay and no TURN service, and the page policy allows one relay host (`tools/build/build.mjs`, from `src/online/relay-url.js`). Details and numbers: docs/ONLINE.md.

New untrusted input: every frame the relay forwards, which is bytes made by other players and by anybody who connects to the relay with a script. `src/online/wire.js` validates each one before the game uses it (type, exact length, handle not 0, phrase index inside the list, name at most 64 bytes and 16 characters, flags with no reserved bits, position inside 20 km, height at most 1000 m); the rest is clamped. Names are reduced to plain text and drawn on a canvas, never as HTML. Each player has a token bucket (burst 60, 40 a second), the relay as a whole has one (burst 800, 400 a second), phrases and offers have minimum gaps on both ends, the table of players holds 16 and at most 8 are drawn, and a frame that fails any check is counted and dropped. `tools/online/fuzz.mjs` has cases for every frame type, a flood, and more players than the table holds: 0 exceptions.

What leaks: the other players the relay sends you see your name, position, vehicle and livery, not your address. The relay (Cloudflare) sees every online player's address in passing and keeps none. The name card says so (`src/online/online.js`, in both languages).

Not done and not claimed: a relay that is modified or misbehaves can still send valid frames that lie (a player who is not there, a position, a name), and a modified client can lie about its own state. Nothing in the game depends on what another player says except a drink offer, which needs the receiver's own yes and costs the giver one euro of in game money.

### Review of the relay and the client before release (20 Nov)

Read the code of `relay-worker/` and `src/online/`, attacked a local relay with scripts, and made a handful of harmless requests to the deployed one. Fixed in the branch, each with a test:

- **`?p2p` put a player online without the name card** (Medium). `?p2p` is the test switch that skips the card, and it worked on the public site: a link `…/?p2p&name=x` joined the relay at once, so the player's name and position were visible to others and their address reached the relay with no card and no answer. Now the switch works only on a page served from localhost or 127.0.0.1 (`tools/online/consent.mjs`).
- **Text frames were not bounded** (Medium). They were counted and ignored, but the runtime reads and bills the whole message (up to 1 MiB) first, and nothing ever rate limited or closed the socket. A text frame now closes it with 1003.
- **A flood was dropped, not closed** (Medium). Frames over the rate and frames past the day's budget were dropped silently, and the socket kept sending. Cloudflare bills every incoming frame whether or not the relay drops it, so the drop saved nothing. 100 refused frames in a row (a quiet spell of 10 s forgives) and the first frame past the address's day now close the socket, and an address that spent its day gets 429 on upgrade until the next UTC day.
- **A few addresses could hold every place** (Medium). 24 places per address and 300 in all meant 13 addresses (or 13 IPv6 /64 blocks) with one frame a minute each kept everybody else out. A full relay now closes one connection of the address holding the most places (one that never said HELLO first, else the quietest) when that address holds at least two more than the newcomer. 300 addresses with one place each still fill it.
- **IPv6 counted by full address**, which limits nothing (one device owns a /64). Counted by /64 now (`address_key` in `proto.rs`); an IPv4-mapped address counts as the IPv4 one. The per address table is emptied if it ever holds 200,000 entries.
- The per address numbers are 24 connections (it was 4: Italian mobile carriers put many phones behind one address) and 800,000 frames a day (it was 400,000).

What the limits protect, and what they cannot. The relay's limits protect the object's CPU and memory, the 300 places, and fairness between addresses. They cannot protect the day's allowance of 100,000 requests (2 million incoming frames), because every upgrade request, `/stats` request, and incoming frame is billed before any of our code runs, and the per address table lives inside the object. One script with a few connections or one HTTP client spends the allowance in minutes and the game stops until 00:00 UTC (no bill: Cloudflare returns errors). What would stop it is outside the Worker: a Cloudflare rate limiting rule in front of it (needs a domain on a Cloudflare zone; `workers.dev` addresses have no zone rules), or the paid plan. The client backs off to one try per ten minutes, so a stopped relay is not hammered by honest pages. This is the owner's decision. The relay's own cost to an attacker is: one address holds up to 24 places and 800,000 frames (40,000 billed requests, 40 percent of the day) before it is closed; 3 addresses spend the day.

Not fixed, stated plainly:

- **Position is public by design.** A client that lies about where it is gets the 8 nearest players of that spot, at most once a second per socket. Measured locally (150 players spread over 10 km): one socket located 105 of them in 133 s by hopping on a 1 km grid, six sockets (one address may open 24) located all 150 in 23 s. With 300 players on the map the whole city is mapped in under a minute. Acceptable for a game where every player's car is visible to the near ones anyway; the name and vehicle come with it. No address ever does.
- **Amplification is bounded by the sets.** One STATE can reach only the players who hold the sender among their 8 nearest. Measured: 40 players spread over 4 km, the sender in 10 of 40 sets, 12 states in gave 13 out (the distance thinning absorbs the rest); one INFO frame gave 10 ENTER frames. The hard cap is the 299 other connections, about 300 times a 23 byte state or a 70 byte ENTER, and needs everyone to hold the sender. A liar cannot aim at one victim beyond that: a victim receives at most its 8 set members (each at the per connection rate, TO at 2 a second), but a liar can fill the victim's set with sybils standing next to it so that no real player is in it (8 sockets, one address).
- **What a client can smuggle** to another player: up to 8 bytes in a TO (only to a player who holds the sender, 2 a second), a name of 16 characters, and the free fields of a state. The relay makes no outbound request and sends nothing to a place a client chooses; the receiving game accepts a TO only as one of the drink messages (3 bytes, fixed shapes) and ignores the rest.
- **Griefing within the rules**: any name (16 characters, plain text, may be abusive or imitate another player: handles are per connection, there are no accounts), teleporting, phrases from a fixed list at most once a second (the receiver also drops them closer than 1.2 s), drink offers at most one card at a time per receiver, one every 8 s per giver, a refused offer mutes that giver's cards for 60 s on the receiver. Nothing more is possible, and nothing stops a person from doing all of it with 24 sockets.
- **The address in the attachment.** The name card says the relay does not store the address. The relay keeps no log of it (no `console_log` of any address, `/stats` has counters only, error texts do not carry it, `wrangler.toml` turns no log or trace on), and no other player receives it. The object does hold the address (its /64 for IPv6) in memory and in each socket's attachment while the socket is open, to count places after a sleep; it goes with the socket. Cloudflare itself sees and may log requests as a provider. If the owner wants the sentence to be literally true in both directions, say "does not keep it after you disconnect".
- **`/stats` is public** and wakes the object. It carries counters only. It costs the same as any request.
- **The worst disconnect** (a player who is in all 299 other sets leaves, so each of them picks a new set) took 3.2 ms natively in a throwaway benchmark (WebAssembly will be slower; not measured), against the 10 ms CPU limit of a free request. An honest crowd cannot build that layout.
- **A client that never reads** while neighbours send: Cloudflare buffers the outgoing frames of that socket. At most 8 neighbours, 2 KB a second, and the socket must send a frame every minute to stay. Whether the runtime bounds that buffer was not verified (no real runtime run of hours).
- **Origin**: the check stops other websites' scripts from driving a visitor's socket (a browser always sends the real Origin), and nothing else: a script outside a browser sets any Origin. `http://localhost:<port>` and `http://127.0.0.1:<port>` are always allowed, in production too; that matters only to a page on the visitor's own machine, and a non-browser client could use any Origin anyway. Another site can embed the game in a frame (a `<meta>` policy cannot set `frame-ancestors`, and GitHub Pages sends no headers): the embedded game has the real origin, shows the name card, and joins only if the visitor clicks it (clickjacking, Low).
- **`ORIGINS`** is `https://palermo-drive.it` only: if the game is also served at `https://www.palermo-drive.it` or at the github.io address, those pages are refused until they are added.
- **`window.__p2p`** is on the public site. It acts only on the player's own page (their wallet, fake players drawn on their own screen); a link cannot call it because no page script is injectable (the policy is `script-src 'self'`, all names and phrases reach the page with `textContent` or `esc()` or a canvas).

Page policy: `connect-src 'self' wss://relay.palermo-drive.it https://relay.palermo-drive.it https://joinlog-…run.app`, read in a production build, with no `ws:`, no wildcard, and nothing left from Nostr or TURN. The bundle has no Trystero, STUN, TURN or RTCPeerConnection code (grepped). The workflow uses no secrets (no `secrets.` anywhere). Dependencies: `cargo audit` on `relay-worker/Cargo.lock`: 0 vulnerabilities, 1 warning (chrono 0.4.45 unmaintained, RUSTSEC-2026-0543, through `worker`); `npm audit` for wrangler 4.165.0: 0. Both lock files are committed. What remains in the repo from the old stack: `relay/` (the retired Cloud Run relay, with its `killswitch/`), the record in section 12, and the git history of `docs/P2P-MULTIPLAYER.md`; nothing in the build or the page reaches them.

### Online protocol v3: more players per receiver (20 Nov, `relay-worker/src/hub.rs`, `src/online/wire.js`)

A v3 player receives up to 32 players (64 if it asks) instead of 8, in batches, and is told how far the nearest player that holds it is. What that changes, each with its number and where it is tested:

- **Amplification is bounded by the sets, and the sets are bigger.** One STATE reaches the players who hold the sender. Measured natively (`relay-worker/hubbench`, `bench --indegree`, 300 players in a 100 m square, every set full): the most held player was held by 33 receivers at K = 8, **104 at K = 32 and 174 at K = 64** (59 and 117 when the crowd is spread over 400 m). Nothing stops a hostile client from standing where it is held by the most: in the plane a point is among the K nearest of at most about 6 K others, so at most 48 receivers at K = 8, **192 at K = 32**, and the whole relay (299) at K = 64. A hostile sender's own limit is 12 frames a second (token bucket), so the most one socket makes the relay send is 12 x 192 = **2,304 frames a second at K = 32** (3,588 at 64), against 576 before; batching sends the same states in fewer frames, never more. Outgoing frames are free on the plan and cost the object about 70 ns each in the hub (the runtime's send is about 30 microseconds locally, so 2,304 of them are about 70 ms of CPU a second: 7 % of a core, measured per frame in docs/ONLINE-CROWD.md, not for this attack).
- **What one sender can push into one victim is bounded and did not grow with K**: 12 states, 1 SAY, 2 TO and 0.5 ENTER (an INFO) a second, about 15 frames a second, whatever the sets. `hub::tests::one_hostile_sender_cannot_push_more_than_its_rate_into_a_victim` sends 200 valid states a second for 10 s and counts what reaches a victim: no more than 12 a second and the burst of 30. A victim's own page also limits what it takes in: 40 states a second from any one player, 640 a second altogether (it was 400), counted for every state inside a batch (see below).
- **A batch is not a way round a limit.** The page counts every state of a BATCH against the sender's own bucket and against the whole relay's, and drops the rest. `tools/online/fuzz.mjs` sends 200 batches of 16 (3,200 states) at once and checks that most are dropped and nothing is thrown. The batch frame is checked entry by entry: the count (2 to 16), each handle (not 0, one we were introduced to or the entry is dropped), each state's length and flags and range, and the frame must end exactly where its last entry ends; fuzz cases for a count that lies either way, a short entry, a leftover byte, handle 0, reserved flag bits, a height flag without a height, an entry from a handle never introduced, and BATCH and AUDIENCE sent to a page whose relay said protocol 2.
- **A client cannot send the relay's frames.** A BATCH or AUDIENCE frame sent to the relay is malformed (counted, the 20th closes the socket): `relay-worker/test/v3-e2e.mjs`.
- **The recompute is the bigger CPU risk, not the fan-out.** A set is recomputed on the player's own state (at most once a second) and when a member leaves. The worst disconnect (the most held player of a natural crowd of 300 leaves, each holder takes its next nearest) took 0.3 ms natively at K = 8, **6.7 ms at K = 32 and 10.9 ms at K = 64** on a loaded Mac (about 63 microseconds a holder), in one event. The attacker's best case, a player held by all 299 others (the earlier review's 3.2 ms at K = 8), is therefore about 19 ms natively at 32 or 64: a durable object event has 30 s of CPU, so this is a pause of that many milliseconds for everybody on the relay, once per disconnect, and no limit. Measured under `wrangler dev` with batching running: 26 % of a core for 128 players at K = 32, 30 % at K = 64.
- **AUDIENCE tells a sender less than ENTER tells a receiver.** It is a band of the distance to the nearest holder, with no handle, and a client that moves can already find who is near it by the set it receives. What an attacker can do with it: stand near players to make them send more. A parked player holding nobody sends every 15 s, with a holder every 4 s, so an attacker (one socket holds at most 64) raises each of up to 64 parked players from 0.07 to 0.25 states a second, 0.18 each: at most about 12 incoming messages a second of the shared allowance per 64 victims, against 64 x 0.25 = 16 for those same players being near each other honestly. A moving player already sent at the near pace for any near player; nothing changes for it.
- **A ghost costs the same as before.** A player whose page vanished without closing its socket stays in other players' sets for the relay's 60 s idle rule (unchanged: the longest silence is now 15 s, still under it) and on their streets for up to 16 s if it was parked and 6 s if it was moving.
- **Version 2 is served as it always was.** A v2 client gets 8 nearest anywhere, plain STATE frames, the 6 byte WELCOME, no AUDIENCE and no BATCH (`hub::tests::a_v2_player_keeps_its_eight_nearest_anywhere_and_never_sees_a_v3_frame`, `test/e2e.mjs` unchanged and passing). A bad HELLO (version 4, a v3 HELLO with a v2 layout, no info) closes with 1008.
- **The wanted set size** (HELLO byte, at most 64) lets a client pick its own fan-out up to the constant `K_MAX`. A client that asks for 64 gets the cost of 64 for itself only. The game asks only on a page served from this machine (`?k=`).
- **Compression.** The deployed relay negotiates permessage-deflate with browsers (measured), which costs CPU for no saving on frames this small. `compatibility_flags = ["no_web_socket_compression"]` in `wrangler.toml` turns it off for the whole Worker, tables included; under `wrangler dev` the extension is still answered, so whether it works must be checked after a deploy with `tools/online/extensions.mjs`.

## Tables for BLATERO (20 Nov, `relay-worker/src/tables.rs`, `tproto.rs`, `shape.rs`, `tglue.rs`)

A second kind of room in the same Worker, for the owner's board game BLATERO: up to 8 sockets per table, found by a 5 character code, frames forwarded in order, nothing stored. Protocol, limits and the exact payload shapes are in `relay-worker/README.md`, "Tables (BLATERO)". It is a separate Durable Object class with one instance, so a panic, a flood or a full socket table on one game does not reach the other's object. This section is a design review made while writing it, plus what was exercised locally against `wrangler dev` (see "Checked"). Nothing was deployed.

### What carries over from the earlier review

- **The Origin check** stops other websites' scripts from driving a visitor's socket and nothing else; a script outside a browser sets any Origin. Checked in the Worker before the object, so a refused browser never wakes it.
- **Floods are closed, not dropped.** Every incoming frame and upgrade is billed before our code runs, so the relay cannot protect the account's daily allowance. Frames over the per socket rate, past the day's budget, or malformed beyond 20 close the socket. A text frame closes it (1003), since the runtime reads and bills the whole message.
- **Addresses.** 24 sockets per address, an IPv6 client by its /64, an IPv4-mapped one as the IPv4 address (the same `address_key`). A full relay (180 sockets) closes one socket of the heaviest address for a newcomer when that address holds at least two more places than the newcomer, so a few addresses cannot hold every place (the same rule as `Hub::victim_for`, ported).
- **No alarms, lazy timers** (no HELLO in 10 s, a member silent 40 s, a table with no frame but beats for 30 minutes). An idle object keeps a dead socket's place until another event arrives, as in the room.
- **The daily allowance is shared by both games and by the account.** A flood against `/t` or `/r` can use it up for everything until 00:00 UTC (no bill, Cloudflare returns errors). Nothing in a Worker prevents that, and a second object does not separate it.
- **No address kept after a disconnect.** The object holds the address (the /64 for IPv6) in memory and in the socket attachment while the socket is open, to count places after a sleep. The log lines (`tables: ...`) carry counters only, no address and no table code. `wrangler.toml` turns no logging or tracing on.
- Everything the relay forwards is untrusted bytes for the client, which must validate each frame and parse each payload inside a try.

### New for tables

- **Guessing a code.** 5 characters from 32 symbols is 33.5 million codes. With 20 live tables one blind guess hits with probability about 6e-7. An address may name 8 distinct codes an hour (counted from HELLO whatever the outcome, closes 1008 beyond), so one address has about 5 in a million per hour, and 1,000 addresses about 0.5 percent per hour. A miss is answered like a hit (an empty table is created) except that a hit's WELCOME carries the roster of pids. The "must be new" flag is an oracle (4002 means the table is live) but it spends the same 8 codes. The code is in the first frame, never in the URL, so it is not in request logs. The owner chose to keep 5 characters.
- **A stranger who gets in.** They can read every frame and send frames to the members, and in a lobby take a seat, or claim a disconnected seat in a game (both are existing game rules). What they see is names, public cards and the game state, nothing secret. There is no kick and no lock, by the owner's decision (a lock conflicts with seat takeover on a new device).
- **Trust between members.** Not fixed, as decided. Every member knows every other member's pid (it is in the roster and in the state), so a member can send HELLO with another's pid and replace that member's live socket (4001), over and over, keeping them out; a member can send a `state` or `patch` with a higher version and be believed; a member can send an `act` carrying another player's id (the client is to drop an `act` whose sender slot does not map to `action.id`: that check is on the client side and is not made by the relay). A per seat secret would fix the first; it is not built.
- **The shared itch origin.** The game frame's Origin is `https://html-classic.itch.zone`, shared by every HTML5 game on itch.io. The relay cannot tell BLATERO from any of them: any itch developer's page can open table sockets from a visitor's browser. What limits that is everything else (per address and per table limits, the rates, the shapes).
- **The payload shape checks (`shape.rs`).** Each of BLATERO's four messages must be a JSON object with exactly its top level keys, each of the right JSON type, within its size cap, at most 32 deep and 4,096 tokens, and no top level key written with an escape or twice. The purpose is that the relay is not worth borrowing for another game. The limits of that: it does not look below the top level, so `players`, `game`, `action` and `p` can carry anything inside the size cap; a person who knows the key lists (they are in the README) can send BLATERO shaped JSON as a private channel. The check is strict about the grammar (the scanner is about 250 lines, builds nothing, and is covered by tests for truncated, over deep, duplicated, escaped and malformed input). A change of shape in BLATERO needs the relay changed and deployed first, which is the price of the check and is written in the README.
- **Hostile payload cost.** A payload is scanned once, linearly, at most 16 KiB, with a depth bound (no recursion beyond 32) and a token bound, and allocates nothing but a flag per key. The cost of a refused payload is the one billed frame plus the scan.
- **Replay and order.** Outsiders cannot capture frames (TLS). Within a table a replayed `act` is dropped by the game's own nonce check while it is among the last 32. The relay adds no sequence numbers.

### What an attacker can still do

- **Spend the day's allowance.** One address may send 100,000 frames a day (5,000 request equivalents at 20 to 1, 5 percent of 100,000) and open upgrade requests that the relay does not count; about 20 addresses spend the day, and then both games stop until 00:00 UTC.
- **Stop other people creating tables.** 30 tables is a global cap and one address may hold 4, so 8 addresses can occupy all 30 with a frame every few minutes to avoid the 30 minute idle close. New codes are then refused (1013) while joining an existing code still works. The fair room rule does not help here, it concerns sockets, not tables.
- **Hold sockets.** Up to 24 per address; 180 distinct addresses are needed to fill the relay against the fair room rule (8 addresses at 22 to 23 each are not enough: a newcomer with one place displaces one of theirs).
- **Kick a known player** from a table by sending HELLO with their pid, repeatedly. It needs the pid, which any member has.
- **Use a table as a private channel** for BLATERO shaped JSON, 8 sockets, 8 frames a second each, 40 a second for the table.
- **Map a table** it has the code of: roster, slots, traffic, and who is host by watching who sends patches.
- **A client that never reads** while others send: Cloudflare buffers the outgoing frames. At most 7 other members and 40 frames a second for the table, and the socket must beat every 40 s to stay. Whether the runtime bounds that buffer was not verified.

### Checked

`cargo test` (the state machine, the frame parser and the shape scanner, natively, including hostile and truncated input and the attachment decode with damage); `test/tables-e2e.mjs` against `wrangler dev` (every frame, every close code, every limit above except a 30 minute idle table, the origin rules in both directions, the shape checks with near misses built from BLATERO's types, a reached daily budget); `test/tables-load.mjs` (20 tables of 6 sockets, delivery and order); and the existing `e2e.mjs` and `load.mjs` unchanged for Palermo Drive's room. Hibernation was seen to happen under `wrangler dev` (the log line `tables: rebuilt N sockets` after 15 s idle) and the table, roster and replacement worked after it.

Not verified: the real Cloudflare runtime (hibernation timing and billing of object time, close frames at the edge, `CF-Connecting-IP` behaviour behind real proxies), a table idle for 30 minutes and a day rolling over (covered by unit tests only), and the behaviour of itch's frame on Safari and iOS.

## GitHub settings and the relay (Open)

### 11. Repository settings (Medium, owner)

Read with `gh api` (some are hidden without admin scope): Dependabot alerts are **disabled** (HTTP 403 "disabled for this repository"); `security_and_analysis` is not visible (secret scanning and push protection may be off); `main` has **no branch
protection** (404; autopush pushes straight to it, so protection would block the workflow you use: leave it, but know it); no topics, no security policy file. Recommended, all free for a public repository: Settings, Code security: enable Dependabot alerts,
Dependabot security updates, secret scanning and push protection, and private vulnerability reporting; Settings, Actions, General: workflow permissions "read repository contents" by default. Pages: HTTPS is enforced (checked).

### 12. The relay in `relay/` (retired as the game's relay on 20 November; the text below is the record of that audit)

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

`.github/workflows/pages.yml`, `.github/dependabot.yml` (new), `.gitignore`, `tools/autopush.sh`, `tools/build/build.mjs` (CSP and referrer meta), `tools/context.py` (User-Agent), `src/buildings.js` (`?photomap=`),
`src/driver.js` (saved picture), `assets/ui/cover.html` (`?mode=`), `docs/SECURITY.md` (this file). Not touched, listed above with lines: `src/world.js` 52 and 234. Local only: `data/mapillary_token` set to mode 600.
