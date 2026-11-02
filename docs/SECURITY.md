# Security audit (board item r6)

Scope: the repository (files, git history, ignore rules, CI, dependencies, CDN use), the game as it runs in a browser (untrusted text and URL parameters reaching the page, saved
data, what the public GitHub Pages site serves) and the multiplayer relay in `server/` (not deployed yet). Method: read-mostly. Everything below was checked by running a command or
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
| 6 | `?worldurl=` makes the game load world data from any server named in a link | Medium | **Open** (street agent's file, exact lines below) |
| 7 | `assets/ui/cover.html?mode=` was reflected into `innerHTML` | Medium (but the page is not published) | Fixed |
| 8 | No Content-Security-Policy on the published page | Low (defence in depth) | Fixed (meta tag in the build) |
| 9 | `.gitignore` had no rule for key files, env files or logs | Low | Fixed |
| 10 | `tools/autopush.sh` commits and pushes everything to the public repo with no secret check | Medium | Fixed (guard added) |
| 11 | Saved driver picture was taken from localStorage as any address | Low | Fixed |
| 12 | GitHub-side settings: Dependabot off, secret scanning and push protection unknown, no branch protection, no private reporting | Medium | **Open** (owner, repository settings) |
| 13 | Relay server: Go 1.22 is out of support, unpinned container images, stats key in the URL query | Low | **Open** |
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
  rate-limit "tokens", `STATS_KEY` as a variable name in `server/deploy.sh`, which generates it with `openssl rand`). No value.
- Images: the nine facade photographs and the `docs/districts` pictures carry no EXIF (no GPS, no camera data). Their sources and licences are in `assets/facades/photo/map.json` and the CREDITS files.
- The friends' reference photos are in `data/npc-refs` (ignored). The tracked sprites (`assets/peds/lpc/garage.*`, `docs/previews/friends-sprites*.png`) are pixel-art characters, not photographs.

### 2. Work e-mail address in a public personal repository (Low, Fixed in HEAD)

`tools/context.py` line 33 sent `contact ebonura@fastly.com` in the User-Agent of its Overpass requests. It now says `contact https://github.com/EBonura/palermo-drive`. The old address stays in
the history (commits that touched that line). Rewriting history of a repository with Pages and 173 commits is not worth it for an address that is already on a work profile; if you want it gone anyway,
that needs `git filter-repo` and a force push. The personal Google account `bonniestudiosdev@gmail.com` is named in `server/DEPLOY.md`, `deploy.sh` and `docs/TODO.md` as the deployment account: public
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
- Added `.github/dependabot.yml` (monthly: Actions, `tools/build` npm, `server` Go modules) so the pins get bumped. It only works once Dependabot is switched on (see the repository settings finding).

### 5. Build dependencies (Info)

`tools/build/package.json`: `esbuild 0.28.2`, `puppeteer-core 25.16.0`, `sharp 0.35.5`, `three 0.187.0`, all exact versions, all `devDependencies`, `private: true`. `package-lock.json` has 85 packages, all from
`registry.npmjs.org`, all with integrity hashes. `npm audit`: found 0 vulnerabilities. The only install script is esbuild's (it fetches its platform binary). `tools/build/serve.mjs` (test server) listens on
127.0.0.1 only; its path check is `file.startsWith(base)`, which also accepts a sibling directory with the same prefix (Info: local tool, never exposed).
Not covered by the lockfile: `server/killswitch/package.json` (`^5.0.0`, `^3.0.0`, no lockfile; a Cloud Function you deploy once), and the Python tools (no requirements file). Neither ships to players.

### 6. Third-party scripts and CDN imports (Low, Info)

- `index.html` (the development tree) maps `three` to `cdn.jsdelivr.net/npm/three@0.187.0/...`: an exact version, so the content does not drift, but there is no Subresource Integrity (an import map can
  carry `integrity` in current Chrome). `assets/ui/cover.html` (source of the share images, not published) does the same.
- The **published** page does not use the CDN: `tools/build` bundles three and the addons into `js/app.<hash>.js`. A built page makes no request to any other host (checked: zero external requests on
  title, play, Garage and a race). Fonts are self-hosted (`assets/ui/fonts`). The bundle's only external strings are Wikimedia, OpenStreetMap and w3.org URLs in credits text.
- No analytics, no ads, no service worker, no cookies, no `postMessage`, no `window.open`.

## Game

### 7. Untrusted text reaching the page as HTML (Info, nothing exploitable found)

All 39 uses of `innerHTML`, `insertAdjacentHTML`, `outerHTML`, `document.write`, `eval`, `new Function` and `srcdoc` in `src/`, `assets/` and `index.html` were read. Sources of untrusted text and what
happens to them:
- **OSM names** (streets, places, venues; `world/` tiles, `palermo-data.js`): shown with `textContent` (HUD street and landmark labels, `startmap.js` popup lines 366 and 367, the radio card) or through `esc()` in template
  strings (`ui.js:633` start list, `event-fares.js:165`, `event-food.js:146`, `event-pubs.js:105`, `achievements.js:86`, `garage-ui.js`). Canvas text (minimap, name tags) is not HTML.
- **Credits converter** (`ui.js` 190 to 235, reads `assets/**/CREDITS.md`, whose authors and file titles come from Wikimedia and from LPC): `inline()` escapes first and only then builds links, and a link must
  start with `http:` or `https:` (no `javascript:`), is wrapped in `target="_blank" rel="noopener"`, and `urlLabel()` strips `<>"`. A `"` in a title cannot leave an attribute.
- **Other players' names** (relay, when deployed): drawn into a canvas texture (`net.js` `tagTexture`), never as HTML; the server also sanitises them (16 runes, no controls or format characters, `server/protocol.go`).
- **URL parameters**: values that reach the DOM are whitelisted (`lang`, `ui`, `view`, `veh`, `liv` against known ids), numeric (`peds`, `speed`, `at`, `time`, `tt`, `rs`, `cash`) or cut (`name`, 16 characters, set with `textContent`).
- **localStorage** (`palermoDrive.settings.v1`, `.net.v1`, `.pid.v1`, `.events.v1`, `.secrets.v1`, `.mapEvents`, `.a2hs`, `.keyhint`, `pd.driver`, the Garage save): every loader validates types and ranges before use
  (`ui.js` 185 to 260, `garage.js` 156 to 170, `driver.js` `cleanSpec`, `missions.js:487`, the pid must match `^[0-9a-f]{16,40}$`). A tampered save needs the page's own origin, so it is self-inflicted at worst.
- `esc()` used to be nine copies that escaped `& < > "` but not `'`. It is now one helper, `src/esc.js`, imported by `ui.js`, `garage-ui.js`, `startmap.js`, `event-hud.js`, `event-fares.js`, `event-food.js`, `event-pubs.js`, `achievements.js` and `net.js`; it also escapes `'` (as `&#39;`), so a value is safe in a single-quoted attribute too. No template used one, so nothing changed for players. Fixed.

### 8. URL parameters that load things from elsewhere

- **`?relay=wss://host/ws`** (`net.js`). Medium once the relay is live, because a link could send the player's name, position and anonymous id to any server and show that server's "players". **Fixed**: honoured on
  localhost only; `?relay=off` still works everywhere. `RELAY_URL` is empty today, so on the public site multiplayer is off and nothing connects.
- **`?photomap=`** (`buildings.js:1410`): a map file naming pictures to draw on facades. **Fixed**: used only when it is on the same origin (a test link may still name another file of the site).
- **`?worldurl=`** (`src/world.js:52` `base: Q.get('worldurl') || 'world/',` and the user at line 234 `const url = p => new URL(CFG.base + p, document.baseURI).href;`). **Open, Medium.** A link
  `…/palermo-drive/?worldurl=https://attacker.example/world/` makes the game fetch the manifest and every tile from the attacker. The data is JSON (no script runs, names go through the safe paths above), so
  the damage is misleading content and memory or CPU abuse (an enormous tile), not code execution. `world.js` is the street agent's file, so I did not edit it. Suggested one-line change for line 52:
  `base: (() => { const w = Q.get('worldurl'); try { const u = new URL(w, location.href); return w && (u.origin === location.origin || /^(localhost|127\.0\.0\.1)$/.test(u.hostname)) ? w : 'world/'; } catch (e) { return 'world/'; } })(),`
  (same site or a local server, for the dev workflow).
- `src/vehicle.js` and `src/vehicle-sphere.js`: read; no network, storage or HTML use, nothing to list.
- **`assets/ui/cover.html?mode=`** was written into `innerHTML` (`<img src="cover-src/bg-${mode}.jpg">`, `className = mode`): `?mode=x"onerror="…` was a DOM XSS. The build skips `*.html` under `assets/`, so it is not on the
  Pages site (checked in `dist/`), but it runs from the dev server. **Fixed**: `mode` is one of `landscape`, `portrait`, `logo`.
- **`?debug`** exposes `window.game`, `window.__missions` and friends, and `?cash=`, `?own=all`, `?fakeprogress`, `?event=` change the player's own game. This is single-player and nothing is verified server-side, so
  it is cheating at worst (Info). The relay only relays positions.
- **`src/driver.js`** (the saved driver): the saved picture was loaded with `img.src = s.png` for any string. **Fixed** (Low): only `data:image/png;base64,` is accepted.

### 9. What the public Pages site exposes (Info, one fix)

The artifact is `dist/` only (about 92 MB: 1,124 `.bin` data and tile files, 109 PNG, music, fonts, the bundle). Not published: `src/`, `tools/`, `docs/`, `server/`, `data/`, source maps, shell, Python, `.mjs`, logs. It does contain four `CREDITS.md`
files, `js/app.*.js.LEGAL.txt` (licence texts of the bundled libraries), `version.json` (a release id), and the whole world: OSM-derived tiles (ODbL, attributed in the game's credits). The page sets no cookies. localStorage holds
the keys listed under the HTML-injection finding plus `palermoDrive.pid.v1` (a random id, written only when the relay is configured).
GitHub Pages sends no custom headers, so there is no CSP, `X-Content-Type-Options` or frame protection from the server (`frame-ancestors` cannot be set from a `<meta>`; the game can be framed by anyone, which only matters for clickjacking, and
there is nothing sensitive to click).
**Fixed (Low, defence in depth):** `tools/build/build.mjs` now writes a `Content-Security-Policy` meta tag and a referrer policy into the built `index.html`:
`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self' https://*.run.app wss://*.run.app; object-src 'none'; base-uri 'self'; form-action 'none'; worker-src 'self'`.
The built site has one external script reference (its own bundle), no inline script and no `eval`, so a strict script policy fits. Tested on the built site under that policy: title screen, driving, the Garage, a race event and the credits raise no
violation. `?relay=wss://evil.example` on a non-local host makes no request; on a local host the policy blocks it anyway. If a feature starts loading something from another host (for example the relay on a domain other than `*.run.app`),
widen `connect-src` in that one line of `build.mjs`.

### 10. `tools/autopush.sh` (Medium, Fixed)

It runs every two minutes, and after a headless smoke test does `git add -A`, commits and pushes to the public `main`. Nothing between a stray secret file and the internet except `.gitignore`. Now, after `git add -A`, it refuses and unstages
(`git reset`) when a staged file name looks like a key file (`.env*`, `*.pem`, `*.key`, `*.p12`, `*.keystore`, `*.token`, `*.secret`, `*_token`, `*credentials*`) or the staged diff (outside `world/`, `docs/perf`, `assets/`) adds a key-shaped
string (AWS, GitHub, `sk-`, Google, `MLY|`, private-key blocks); it prints `NOT pushed`. Tested in a scratch repository (both guards fire).

## GitHub settings and the relay (Open)

### 11. Repository settings (Medium, owner)

Read with `gh api` (some are hidden without admin scope): Dependabot alerts are **disabled** (HTTP 403 "disabled for this repository"); `security_and_analysis` is not visible (secret scanning and push protection may be off); `main` has **no branch
protection** (404; autopush pushes straight to it, so protection would block the workflow you use: leave it, but know it); no topics, no security policy file. Recommended, all free for a public repository: Settings, Code security: enable Dependabot alerts,
Dependabot security updates, secret scanning and push protection, and private vulnerability reporting; Settings, Actions, General: workflow permissions "read repository contents" by default. Pages: HTTPS is enforced (checked).

### 12. The relay in `server/` (Low now, Medium when deployed)

Read, not run. Good: WebSocket origin allow-list (`ebonura.github.io`, `localhost:*`, `127.0.0.1:*`), 80-byte read limit, name sanitiser, per-IP ping bucket (30 per minute, 40 new ids a day), `/ping` body capped at 128 bytes, HTML stats page escaped with
`html.EscapeString`, stats key compared in constant time, distroless non-root image, at most one instance, a monthly free-tier cap that closes the WebSocket door, and a billing kill-switch function. Open:
- `server/go.mod` says Go 1.22 and `Dockerfile` builds with `golang:1.22-alpine`; Go 1.22 no longer gets security fixes. Move to a supported Go and pin both base images by digest. `github.com/coder/websocket v1.8.12`: run `govulncheck` before deploying (not installed here).
- `/stats?key=…` puts the key in the URL (Cloud Run request logs, browser history). Accept it from an `Authorization` header instead, or rotate after each use.
- `ALLOWED_ORIGINS` in `deploy.sh` always appends `localhost:*,127.0.0.1:*`: fine for a toy, drop it for production (the Origin header is only a browser-side control anyway).
- `--allow-unauthenticated` is the point of a public relay; the cost control is `--max-instances=1`, the app's own cap and the kill-switch, which reacts to a budget notification after the spend (billing alerts lag by hours). Keep the budget at a figure you can lose.
- `server/killswitch/` has `^` version ranges and no lockfile; add `package-lock.json` before deploying it.

## What changed in this audit (files)

`.github/workflows/pages.yml`, `.github/dependabot.yml` (new), `.gitignore`, `tools/autopush.sh`, `tools/build/build.mjs` (CSP and referrer meta), `tools/context.py` (User-Agent), `src/net.js` (`?relay=`), `src/buildings.js` (`?photomap=`),
`src/driver.js` (saved picture), `assets/ui/cover.html` (`?mode=`), `docs/SECURITY.md` (this file). Not touched, listed above with lines: `src/world.js` 52 and 234. Local only: `data/mapillary_token` set to mode 600.
