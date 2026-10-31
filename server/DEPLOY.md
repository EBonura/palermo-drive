# Palermo Drive relay: deploy notes

The relay is one small Go program (`server/`, about 14 MB image, 19 MB of RAM with 32 simulated players). It does two jobs.

1. **Anonymous statistics.** The game sends a tiny HTTP ping (`POST /ping`) when a session starts, about every 3 minutes of active play and when the page is hidden. The relay keeps online now, unique players per day and month, sessions, play minutes, peak concurrency, and shows them at `/stats?key=SECRET`.
2. **Multiplayer.** A WebSocket (`/ws`) that forwards each player's position to the players within 400 m. It is only open while at least two multiplayer players are online at the same time.

Everything is built so the project stays inside the Google Cloud free tier, with three layers of protection: the relay counts its own usage and stops accepting WebSockets at 70% of the free tier, the clients keep connections open as briefly as possible, and a budget kill switch detaches billing as the last resort.

## 1. One-time setup on the new Google account

Use a dedicated gcloud configuration so the default one (a work account and project) is never touched. `--no-activate` matters: without it gcloud would make the new configuration the active one for every terminal.

```sh
gcloud config configurations create palermo-drive --no-activate
export CLOUDSDK_ACTIVE_CONFIG_NAME=palermo-drive     # only in this terminal
gcloud auth login bonniestudiosdev@gmail.com
gcloud config set account bonniestudiosdev@gmail.com
```

Billing accounts can only be created in the console (https://console.cloud.google.com/billing) with a payment method. Then create the project and link it (pick your own unique project id, it is used as `PROJECT_ID` below):

```sh
PROJECT_ID=palermo-drive-<something unique>
gcloud projects create $PROJECT_ID --name="Palermo Drive" --account=bonniestudiosdev@gmail.com
gcloud billing accounts list --account=bonniestudiosdev@gmail.com        # note the ACCOUNT_ID
gcloud billing projects link $PROJECT_ID --billing-account=<BILLING_ACCOUNT_ID> --account=bonniestudiosdev@gmail.com
gcloud config set project $PROJECT_ID
```

Check which free-tier terms apply to a new account (free trial credit versus the always-free products) on https://docs.cloud.google.com/free/docs/free-cloud-features.

## 2. Deploy

```sh
cd server
./deploy.sh $PROJECT_ID us-east1 bonniestudiosdev@gmail.com
```

All three arguments are required, nothing has a default. The script refuses `@fastly.com` accounts and project ids containing `csoc` or `fastly`, runs only in the `palermo-drive` configuration and passes `--project` and `--account` on every gcloud command. It is safe to run again for every update. It:

1. enables Cloud Run, Artifact Registry, Cloud Build, Firestore and IAM;
2. creates one Artifact Registry repository with a clean-up policy (keep the `latest` image, delete untagged ones after a day);
3. creates a service account that can only use Firestore;
4. creates the Firestore database if it does not exist (this holds the statistics, see below);
5. builds the image with Cloud Build (or locally: `BUILD=local ./deploy.sh ...`, which needs docker and skips Cloud Build entirely);
6. deploys to Cloud Run with `--min-instances=0 --max-instances=1 --cpu=1 --memory=512Mi --concurrency=300 --timeout=3600`, request-based billing (the default), unauthenticated access (browsers must reach it).

It prints the service URL, the `wss://` URL to put in `src/net.js` (`RELAY_URL`) and the stats URL with a random key. Keep the key private; it is stored as an environment variable of the service. Set your own with `STATS_KEY=... ./deploy.sh ...`.

Region: `us-east1` (South Carolina) is the pick if "free" has to mean exactly zero. It is a Tier 1 Cloud Run region, and Cloud Run's 1 GiB of free outbound traffic only exists for North America. The cost is latency (my estimate is 100 to 150 ms round trip from Sicily, not measured). The client buffers 150 ms and interpolates, so it is playable. `europe-west8` (Milan) and `europe-west1` are also Tier 1 for compute (https://cloud.google.com/run/pricing, "Regional price tiers"), so the CPU, memory and request free tier applies there too, but every byte sent out is billed. At the measured rates that is cents per month, not zero. `deploy.sh` sets `EGRESS_FREE_MIB=0` outside `us-*` regions, which turns the relay's egress cap off.

Afterwards:

```sh
curl https://<service-url>/healthz                    # ok
open "https://<service-url>/stats?key=<STATS_KEY>"    # HTML view, add &format=json for JSON
```

## 3. Kill switch (Google's cap-costs pattern)

A budget alert only sends email. To actually stop charges, the pattern from https://cloud.google.com/billing/docs/how-to/disable-billing-with-notifications is: budget, Pub/Sub topic, a small function that detaches the billing account from the project.

```sh
./killswitch.sh $PROJECT_ID us-east1 bonniestudiosdev@gmail.com <BILLING_ACCOUNT_ID> 5EUR
```

`5EUR` is the budget (a number, optionally with the currency of the billing account). The script enables the APIs, creates the topic and a Node function (`killswitch/`), gives its service account Billing Account Administrator on the billing account (as in Google's example), and creates a budget limited to this project with email alerts at 50% and 90%. The function acts when `costAmount > budgetAmount`.

Know the limits, they are Google's: budget notifications lag the real spend by hours, so this can overshoot a little; when it fires it removes billing from the project and every service stops, free tier included, and data may be lost; you re-link billing by hand to restart. A project that is locked to its billing account cannot be detached. This is why the relay has its own cap as the first line.

## 4. Connect the game

In `src/net.js` set `const RELAY_URL = 'wss://<service-url-host>/ws';`, commit, done. For a test without editing: `?relay=wss://<host>/ws`. `?relay=off` disables it, `?name=Foo` sets the name for one page load, `?room=xyz` joins a private room.

## 5. What can cost money, and how it is held at zero

All free-tier numbers are from Google's pages on 2026-10-31. Google may change them.

| Source | Free allowance | What the relay does | Source page |
| --- | --- | --- | --- |
| Cloud Run CPU | 180,000 vCPU-seconds per month (request-based billing) | 1 vCPU, billed only while a request, including an open WebSocket, is active. Counted in code, stops WebSockets at 70% (126,000 s = 35 h) | https://cloud.google.com/run/pricing |
| Cloud Run memory | 360,000 GiB-seconds per month | 0.5 GiB: 126,000 s uses 63,000 GiB-s, never the limit | same |
| Cloud Run requests | 2 million per month | Pings, WebSocket upgrades, stats. Counted, 70% = 1.4 million | same |
| Network egress | 1 GiB per month, North America only | Counted per frame (payload + 2 byte header + 40 bytes TCP/TLS share). Cap 70% in `us-*` regions | https://docs.cloud.google.com/free/docs/free-cloud-features, https://cloud.google.com/vpc/network-pricing |
| Firestore | 1 GiB, 50,000 reads and 20,000 writes per day, 10 GiB out per month, one free database per project | At most 3 small documents written per minute while something changed (4,320 writes a day worst case), 3 reads per cold start | https://cloud.google.com/firestore/pricing |
| Artifact Registry | 0.5 GB per month | One 14 MB image, clean-up policy deletes untagged ones | https://docs.cloud.google.com/free/docs/free-cloud-features |
| Cloud Build | 2,500 build-minutes per month (e2-standard-2) | A build takes a minute or two; use `BUILD=local` for none | same |
| Cloud Logging | first 50 GiB per month | One summary line per minute at most, and none when nothing changed. Cloud Run's own request log adds an entry per request (a few hundred bytes) | same |
| Cloud Storage | 5 GB-months, US regions only | Not used by the relay. Cloud Build stages the source in a `<project>_cloudbuild` bucket (a few KB) | same |
| Pub/Sub, Cloud Run functions | 10 GiB of messages; 2 million invocations | The kill switch: a handful of budget messages a day | same |

Notes on the Cloud Run row. The free tier is applied as a spending discount at Tier 1 prices and is aggregated per billing account, so other Cloud Run services on the same billing account share it. Request-based billing bills instance time from the start of the first request to the end of the last one, rounded up to 100 ms. Prices beyond the free tier (Tier 1, request-based, active time): $0.000024 per vCPU-second, $0.0000025 per GiB-second, $0.40 per million requests. One instance running all month at 1 vCPU and 0.5 GiB would cost roughly 2,592,000 s x $0.0000253 = about $65, minus the free tier. So 24/7 is not free; the design never lets it happen.

What Google says about WebSockets (https://docs.cloud.google.com/run/docs/triggering/websockets): an instance with any open WebSocket connection is considered active, so CPU is billed the whole time. WebSockets are HTTP requests with a timeout of up to 60 minutes (default 5), after which the connection is cut, and clients should reconnect. The relay sets 60 minutes, closes sessions itself at 55 minutes with close code 4002, and the client reconnects within a second.

### The relay's own usage cap

The relay accounts, per UTC month and persisted in Firestore with the statistics: seconds with at least one open WebSocket, 0.1 s per HTTP request (the billing round-up), 3 s per cold start, requests, and egress bytes. The largest share of any dimension is compared to the free tier:

- at **70%** it answers 503 to new WebSockets and tells clients through the ping answer (`{"mp":0}`), so they play single-player and keep pinging;
- at **85%** it disconnects everybody (close code 4003);
- it reopens when the month rolls over.

Tunable with `CAP_PCT`, `HARD_PCT`, `CPU`, `MEM_GIB`, `EGRESS_FREE_MIB` (environment) or flags. The 30% margin covers what the relay cannot see: instance startup and shutdown time, a billing month that is not the UTC month, and a lost minute of counters if an instance dies. The counters live in one instance's memory and are saved at most once a minute, so `max-instances=1` is what makes them correct.

### Keeping the connection open as little as possible

The client opens the WebSocket only when all of these hold: multiplayer is open (ping answer), the player has a name and is not in offline mode, the game state is `play` (not menu or pause, with a 10 s grace), the tab is visible (5 s grace), the player pressed something in the last 2 minutes, and **another multiplayer player is online right now**. The ping answer carries that count, and a lone player re-asks every 45 seconds instead of holding a connection. Instance time is therefore only spent while two or more people are actually driving together. The server also drops a connection that sends no position for 3 minutes (close code 4001, the client reconnects when the car moves).

### Player-hours that fit

Multiplayer instance-time at the 70% cap is 35 hours a month. Those are hours in which at least one WebSocket is open, which with the rule above means at least two players. With *c* players online during those hours that is 35 x *c* player-hours: about 70 with two at a time, 140 with four. Egress (in a US region) caps at about 717 MiB; at the measured rates below that is roughly 450 player-hours with two players at a time and 200 in a crowded group, so instance time is the tighter limit up to about six at once. Single-player play is not limited by any of this, it only sends pings: about 21 requests per player-hour, 0.1 s each in the accounting, so 10,000 single-player hours a month would use 17% of the instance-time budget and 15% of the request budget. My conclusion: plan for about 70 to 200 player-hours of real multiplayer a month and unlimited solo play, and expect the relay to say "multiplayer is resting" near the end of a very busy month rather than ever bill.

## 6. Protocol and measured bandwidth

Binary WebSocket frames, little endian, about 8 to 10 Hz. Full layout in `protocol.go`. A position update from a client is 11 bytes: type, x and z as int16 in 0.1 m from Quattro Canti, heading in a byte (1.4 degrees), speed in 0.5 m/s, and steer, roll, lean (tip) as signed bytes, plus a flags byte (nitro, brake, drift). The client only sends when the quantised state changed. The server sends each receiver one batched frame per 100 ms tick: 2 bytes plus 11 bytes per player whose state changed and who is within 400 m (a player already in view stays until 456 m, to avoid flicker). Players over 150 m away are updated every 2nd tick and over 300 m every 4th. Names (16 characters, control and format characters stripped, a tiny slur filter) and liveries are sent when a player enters your radius or changes. Rooms hold 32 players, the 33rd goes to a new room. Limits: 80 byte messages, 25 messages per second per connection, 6 connections per IP, 256 in total, Origin check, 45 s read timeout, 10 s to send a name.

Measured with `server/loadtest` (32 bots driving continuously at 10 Hz on localhost, payload plus WebSocket headers, TCP/TLS not included):

| Situation | Server to client, per player-minute | Client to server |
| --- | --- | --- |
| Alone | about 0.2 kB | 10 kB while driving, a few bytes when parked |
| 2 players close | 6.4 kB | 10 kB |
| 8 players within 300 m | 34 kB | 10 kB |
| 32 players spread over 1 km x 1 km | 32 kB | 10 kB |
| 32 players spread over 2 km x 2 km | 9 kB | 10 kB |
| 32 players all within 300 m (worst case) | 147 kB | 10 kB |

Only the server to client direction is billed as egress. Per frame TCP and TLS add roughly 40 bytes in the relay's accounting, which is about 25 kB per player-minute on top at 10 frames a second. A 32 player crowd in one spot would use 40 to 80 kB/s of server egress; the relay used 0.46 s of CPU in 20 s with 32 clients. Ping traffic: about 100 bytes per request, one per 3 minutes of play.

## 7. Statistics

`GET /stats?key=SECRET` gives HTML (browser) or JSON (`&format=json`, or any non-HTML Accept): players online now (a ping in the last 4 minutes), players in multiplayer now, unique players per day and month, sessions, play minutes, average minutes per session and per player, peak online and peak multiplayer, 45 days and all months of history, and the free-tier usage of the current month with the percentage of the safe cap used. Without `STATS_KEY` set the endpoint does not exist.

Privacy: the browser makes up a random id and keeps it in localStorage. The relay stores only the first 6 bytes of its SHA-256, in a set per day and per month, so it can count unique players. No IP address, no name and no raw id is written anywhere (IPs are used in memory for a rate limit and forgotten). Sets stop growing at 50,000 ids per day or month (a Firestore document is limited to 1 MiB).

Persistence: Firestore, collection `relay`, documents `state`, `ids-d-<day>`, `ids-m-<month>`; loaded at start, written at most once a minute and only when something changed, and on SIGTERM. A lost minute is the worst case.

## 8. Operations

```sh
export CLOUDSDK_ACTIVE_CONFIG_NAME=palermo-drive
gcloud run services logs read relay --region us-east1 --project $PROJECT_ID --account bonniestudiosdev@gmail.com --limit 20
gcloud run services update relay --region us-east1 --project $PROJECT_ID --account bonniestudiosdev@gmail.com --update-env-vars CAP_PCT=50   # tighter cap
gcloud projects delete $PROJECT_ID --account bonniestudiosdev@gmail.com        # remove everything
```

Local run for development: `GOTOOLCHAIN=go1.24.13 go run . -addr :8791 -data ./data` (the `data/` folder is git-ignored). Load test: `go run ./loadtest -url ws://localhost:8791/ws -n 32 -side 1000 -dur 30s` (start the relay with `-per-ip 1000` since all bots share one address). Note: Go 1.22.2 binaries are killed by macOS 26 at launch (missing LC_UUID); use a newer toolchain locally. The Docker build uses Go 1.22 on Linux and is unaffected.

## 9. Alternative: always-free e2-micro VM with Caddy

The Compute Engine free tier is one non-preemptible e2-micro per month, in `us-west1`, `us-central1` or `us-east1` only, with 30 GB-months of standard persistent disk and 1 GB of outbound traffic per month from North America (https://docs.cloud.google.com/free/docs/free-cloud-features). No instance-hour budget to manage, always on, but a US-only location, one shared-CPU VM, no scale to zero, and you maintain it. It needs a DNS name pointing at the VM (browsers need `wss://`), and Caddy gets the certificate by itself:

```sh
# on the VM (Debian): install caddy from its apt repo, copy the relay binary (GOOS=linux GOARCH=amd64 go build) to /usr/local/bin/relay
# /etc/caddy/Caddyfile
relay.example.com {
    reverse_proxy localhost:8080
}
# /etc/systemd/system/relay.service: ExecStart=/usr/local/bin/relay -addr :8080 -vm -data /var/lib/relay  (Environment=STATS_KEY=...)
```

`-vm` turns off the Cloud Run instance-time and request accounting and keeps the egress cap (1 GiB is the VM's free egress too). Statistics persist to files in `-data`. Caddy proxies WebSockets without extra configuration. Billing protections still apply: set the budget and the kill switch on that project too (the function detaches billing and the VM stops).
