# joinlog: the play log

A small Rust service on Cloud Run that appends anonymous play and performance reports from the game to a BigQuery table. The game side is `src/playlog.js`; it sends nothing while `src/playlog-url.js` is empty.

## What is saved

One row per report. A player sends one report after a few seconds of driving (`join`), one about every 3 minutes of driving (`alive`, a batch of what happened since the last), and one when the page goes away (`leave`, through `sendBeacon`). Solo players send them too, without a name. Players online by their own yes on the name card send the name they chose. The switch is Options > Game stats; it stops all sending at once.

Columns (`ts` is server time): `event`, `visit` (random per page load, never stored on the device), `name`, `device` (phone or desktop), `lang`, `version`, `secs` (since the visit began), `players` (most other players drawn at once, online only), `play_s` (driving seconds in the batch), `fps`, `fps_slow_ms` (the slowest 1 percent of frames took at least this long), `auto_lvl`, `fps_mode`, `shadow`, `res_pct`, `mem_mb`, `gpu` (maker only), `vehicle`, `dist_m`, `cash`, `busts`, `missions` (`id=started.done.failed;...`).

Never saved: address, user agent, location, position, route, chat phrases, neighbourhood, any id that lasts. Partitions older than 12 months are deleted by BigQuery itself (`partition_expiration_days = 365`).

## Volume

A visit makes 2 rows plus one per 3 minutes of driving: a 15 minute visit is 7 rows, a 60 minute one 22. The request is about 300 to 600 bytes, a stored row about 150 to 250 bytes (an estimate from the schema, not measured at scale). The daily cap of 3 000 rows is therefore about 430 visits of 15 minutes a day, and at the cap the table grows by under 1 MB a day (the free 10 GiB is nowhere near). Past the cap the service refuses until the next UTC day and the data for the rest of that day is lost; raise `DAILY_ROWS` (a redeploy of the same revision with a new variable) if the game gets there.

## Reading it

BigQuery console, project `palermo-drive-bonnie`, dataset `joinlog`. Two views are ready:

```sql
-- one row per visit
SELECT * FROM `palermo-drive-bonnie.joinlog.visits` ORDER BY first_seen DESC LIMIT 100;

-- a count per day
SELECT * FROM `palermo-drive-bonnie.joinlog.daily` ORDER BY day DESC;

-- who played online lately, for how long
SELECT name, first_seen, ROUND(seconds_since_join / 60) AS minutes, device FROM `palermo-drive-bonnie.joinlog.visits` WHERE name IS NOT NULL ORDER BY first_seen DESC LIMIT 50;

-- frame rate by GPU maker and Auto level
SELECT gpu, auto_lvl, fps_mode, COUNT(*) AS reports, ROUND(AVG(fps), 1) AS avg_fps, ROUND(AVG(fps_slow_ms), 1) AS slow_ms FROM `palermo-drive-bonnie.joinlog.events` WHERE event = 'alive' GROUP BY 1, 2, 3 ORDER BY reports DESC;

-- missions started, done and failed (the column is text: split it)
SELECT SPLIT(m, '=')[OFFSET(0)] AS mission, SUM(CAST(SPLIT(SPLIT(m, '=')[OFFSET(1)], '.')[OFFSET(0)] AS INT64)) AS started, SUM(CAST(SPLIT(SPLIT(m, '=')[OFFSET(1)], '.')[OFFSET(1)] AS INT64)) AS done, SUM(CAST(SPLIT(SPLIT(m, '=')[OFFSET(1)], '.')[OFFSET(2)] AS INT64)) AS failed
FROM `palermo-drive-bonnie.joinlog.events`, UNNEST(SPLIT(missions, ';')) AS m WHERE missions IS NOT NULL GROUP BY 1 ORDER BY started DESC;
```

Every query costs at least 10 MB of the 1 TiB a month that BigQuery gives for free, so ad hoc reading is free in practice.

## The service

`POST /e` is the only route; everything else, every other method, `OPTIONS` included, is a bare 404 (a no-cors `fetch` and `sendBeacon` with a text body need no preflight). Nothing ever returns rows. Refusals are empty bodies: 403 wrong or missing `Origin`, 413 body over 2048 bytes, 400 not a valid report, 429 limits, 503 the table could not be reached.

In order:

1. `Origin` must equal one of `ORIGINS` exactly (default `https://ebonura.github.io`). A script outside a browser can send any `Origin`, so this stops other websites using the endpoint from a visitor's browser, not a determined person.
2. Body at most 2048 bytes (`Content-Length` first, then a hard limit while reading).
3. Rate limits per network (/24, or /48 for IPv6: 30 burst, 1 every 2 s) and per address (6 burst, 1 every 10 s), then a daily request cap (`DAILY_REQS`, 20 000). The address comes from the last `X-Forwarded-For` entry, which Cloud Run's front end appends, so a client cannot forge it; it is hashed with a random salt that exists only in memory, kept only in memory, and never written or logged.
4. Strict parse (`src/report.rs`): exact fields (unknown field = refused), exact types, known values for event, device, language, GPU maker, mode and shadow size, ranges for every number, ids matched against a tight pattern, name cleaned (invisible characters removed, spaces collapsed) and refused above 16 characters.
5. A global write limit (burst 10, 2 a second) and a daily row cap (`DAILY_ROWS`, 3 000). The row count is read from the table when an instance starts, so a restart cannot start a fresh allowance. After the cap the service answers 429 and writes nothing.
6. Insert with a fixed SQL statement whose values are query parameters. No value is ever part of the SQL text. Each query is capped at 20 MB billed.

The service prints nothing, and its Cloud Run logs are excluded (below).

### Why a DML insert

The cheaper-looking ways are not free: legacy streaming inserts and the Storage Write API over REST are billed per 200 MB, and the free gRPC write API needs a much larger client. A `INSERT ... VALUES (@param, ...)` query counts against the free 1 TiB of query processing a month (about 10 MB per statement), and a daily cap of 3 000 rows is about 600 GiB a month at the very most, so it stays free.

## Cloud setup (what `deploy.sh` makes)

Project `palermo-drive-bonnie`, region `europe-west8`, always through the gcloud configuration `palermo-drive` and `--account bonniestudiosdev@gmail.com`.

- Service account `joinlog-run`, no keys. The service gets its token from the metadata server.
- Custom role `joinlogWriter` (`bigquery.tables.get`, `getData`, `updateData`) granted on the one table, plus `roles/bigquery.jobUser` on the project (it can run a query job; it has no data access with it).
- BigQuery dataset `joinlog` with no public access, table `events` (`events_test` for tests), views `visits`, `daily`, `perf`, `missions` and `activity` (players per minute, for charts).
- Cloud Run service `joinlog`: 1 vCPU, 128 MiB, concurrency 1, `--min-instances=0 --max-instances=1`, 15 s timeout, request-based billing, first generation environment.
- A log exclusion `joinlog` on the `_Default` sink: no request logs, no container logs for this service.
- A budget (GBP 2) on the existing `billing-budget-alerts` topic, whose function (`relay/killswitch/`) detaches billing from the project when cost passes the budget.

Deploy: `./deploy.sh palermo-drive-bonnie europe-west8 bonniestudiosdev@gmail.com events 2`. To start sending, put the service URL plus `/e` in `src/playlog-url.js`; the next build adds its host to the Content-Security-Policy and switches the wording on the name card. Local test: `cargo build`, then `tools/build/playlogcheck.mjs` (see its header).

## Threat summary

Reachable by anyone on the internet: `POST /e`. A script can post well formed fake rows, within the limits above: per address and network, a daily cap of 3 000 rows, so the table cannot be flooded or filled. A public endpoint cannot prove a request came from the game; App Check or a bot check would narrow that and are not built.

Reachable by nobody but the owner: the table and the views (BigQuery IAM, project owner). The service account can append to and read that one table and run jobs; it has no key, so there is nothing to leak. The page and the repository hold only the public URL.

Cost: expected 0 (prices read on 2026-11-03 from cloud.google.com/run/pricing and cloud.google.com/bigquery/pricing). Cloud Run with request-based billing gives 180 000 vCPU-seconds, 360 000 GiB-seconds and 2 million requests a month free, then $0.000024 per vCPU-second, $0.0000025 per GiB-second and $0.40 per million requests; europe-west8 is a Tier 1 region and the free tier is applied to every region as a Tier 1 discount. BigQuery gives 10 GiB of storage and 1 TiB of query processing a month free. One write holds the instance about 1.5 s (measured), so the full daily cap of 3 000 rows is about 135 000 vCPU-seconds a month, inside the free 180 000. The measured insert statements are billed 0 bytes.

Abuse cannot fill the table, but a public endpoint cannot refuse requests before Cloud Run bills them: every request that reaches the container counts after the free 2 million, and nothing in Google Cloud turns that into a hard limit. What bounds it: one instance with concurrency 1 and about 1.7 ms of service time for a refused request (read from a request log) can take roughly 500 requests a second, so a flat-out flood costs at most about $0.8 an hour (requests plus a busy instance). The budget kill switch ends it, with the delay of Google's cost reporting (hours, per `relay/killswitch.sh`); that makes the worst case one flood of a few hours, in the order of a few dollars, followed by billing detached from the project until the owner re-links it. Concurrency 1 is that trade: real players' reports wait or are dropped under a flood, in exchange for the smaller worst case.
