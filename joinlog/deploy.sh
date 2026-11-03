#!/usr/bin/env bash
# Sets up and deploys the play log service in Google Cloud. Safe to run again (every step checks first). Uses the gcloud configuration 'palermo-drive' and passes the account on every call:
# it never touches the default configuration (the owner's work account).
#
#   ./deploy.sh PROJECT_ID REGION ACCOUNT TABLE [BUDGET_GBP]
#   ./deploy.sh palermo-drive-bonnie europe-west8 bonniestudiosdev@gmail.com events_test       # first against a test table
#   ./deploy.sh palermo-drive-bonnie europe-west8 bonniestudiosdev@gmail.com events 2          # then the real one, with a 2 GBP budget that arms the kill switch
#
# What it creates (nothing else is touched): service account joinlog-run, custom role joinlogWriter, BigQuery dataset joinlog (in REGION) with the table and four views,
# Cloud Run service joinlog, one log exclusion on the _Default sink, and with BUDGET_GBP one budget on the existing billing-budget-alerts topic (relay/killswitch.sh).
set -euo pipefail
die() { echo "error: $*" >&2; exit 1; }
[ $# -ge 4 ] || { sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }
PROJECT=$1; REGION=$2; ACCOUNT=$3; TABLE=$4; BUDGET=${5:-}
case "$ACCOUNT" in *@fastly.com) die "refusing to use a work account";; esac
case "$PROJECT" in *csoc*|*fastly*) die "refusing to use what looks like a work project";; esac
case "$TABLE" in events|events_test) ;; *) die "TABLE must be events or events_test";; esac
export CLOUDSDK_ACTIVE_CONFIG_NAME=palermo-drive
gcloud auth list --format='value(account)' 2>/dev/null | grep -qx "$ACCOUNT" || die "$ACCOUNT is not logged in: gcloud auth login $ACCOUNT"
G=(gcloud "--project=$PROJECT" "--account=$ACCOUNT" --quiet)
HERE=$(cd "$(dirname "$0")" && pwd)
SA_NAME=joinlog-run; SA="$SA_NAME@$PROJECT.iam.gserviceaccount.com"; ROLE=joinlogWriter; DATASET=joinlog; SERVICE=joinlog
ORIGINS=${ORIGINS:-https://ebonura.github.io}
Q=(bq "--project_id=$PROJECT" "--location=$REGION")   # bq uses the credentials of the active gcloud configuration

"${G[@]}" iam service-accounts describe "$SA" >/dev/null 2>&1 || "${G[@]}" iam service-accounts create "$SA_NAME" --display-name="Play log service (no keys)"
# the only data permissions the service has: this table's metadata, reading it (for the daily row count) and appending to it
"${G[@]}" iam roles describe "$ROLE" >/dev/null 2>&1 || "${G[@]}" iam roles create "$ROLE" --title="Play log writer" --permissions=bigquery.tables.get,bigquery.tables.getData,bigquery.tables.updateData
"${G[@]}" projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role=roles/bigquery.jobUser --condition=None >/dev/null   # running a query job at all; no data access comes with it

"${Q[@]}" show --dataset "$PROJECT:$DATASET" >/dev/null 2>&1 || "${Q[@]}" mk --dataset --description="Play log (joinlog service)" "$PROJECT:$DATASET"
"${Q[@]}" query --use_legacy_sql=false --nouse_cache "
CREATE TABLE IF NOT EXISTS \`$PROJECT.$DATASET.$TABLE\` (
  ts TIMESTAMP NOT NULL OPTIONS (description = 'server time'),
  event STRING OPTIONS (description = 'join, alive (a batch about every 3 minutes of driving) or leave'),
  visit STRING OPTIONS (description = 'random per page load, never saved on the device'),
  name STRING OPTIONS (description = 'the name chosen on the name card, only for players online by their own yes'),
  device STRING, lang STRING, version STRING,
  secs INT64 OPTIONS (description = 'seconds since the visit began'),
  players INT64 OPTIONS (description = 'most other players drawn at once in the batch (online only)'),
  play_s INT64 OPTIONS (description = 'seconds spent driving in the batch'),
  fps INT64, fps_slow_ms INT64 OPTIONS (description = 'the slowest 1 percent of frames took at least this many ms'),
  auto_lvl INT64 OPTIONS (description = 'step of the Auto graphics ladder, 0 best'), fps_mode INT64 OPTIONS (description = '60 or 30'),
  shadow INT64 OPTIONS (description = 'shadow map size, 0 off'), res_pct INT64 OPTIONS (description = 'resolution scale in percent'),
  mem_mb INT64, gpu STRING OPTIONS (description = 'maker only'), vehicle STRING,
  dist_m INT64, cash INT64 OPTIONS (description = 'money earned in the batch'), busts INT64,
  missions STRING OPTIONS (description = 'id=started.done.failed;...')
) PARTITION BY TIMESTAMP_TRUNC(ts, DAY) OPTIONS (partition_expiration_days = 365, description = 'Play log: rows older than 12 months are deleted by BigQuery itself');" >/dev/null
"${Q[@]}" query --use_legacy_sql=false --nouse_cache "
CREATE OR REPLACE VIEW \`$PROJECT.$DATASET.visits\` OPTIONS (description = 'One row per visit') AS
SELECT visit, MIN(ts) AS first_seen, MAX(ts) AS last_seen,
  ARRAY_AGG(name IGNORE NULLS ORDER BY ts DESC LIMIT 1)[SAFE_OFFSET(0)] AS name,
  ARRAY_AGG(device ORDER BY ts DESC LIMIT 1)[OFFSET(0)] AS device, ARRAY_AGG(lang ORDER BY ts DESC LIMIT 1)[OFFSET(0)] AS lang, ARRAY_AGG(version ORDER BY ts DESC LIMIT 1)[OFFSET(0)] AS version,
  MAX(secs) AS seconds_since_join, SUM(IFNULL(play_s, 0)) AS driving_seconds, LOGICAL_OR(event = 'leave') AS left_cleanly,
  SAFE_DIVIDE(SUM(fps * play_s), SUM(IF(fps IS NULL, 0, play_s))) AS avg_fps, MAX(players) AS most_players_seen,
  SUM(IFNULL(dist_m, 0)) AS distance_m, SUM(IFNULL(cash, 0)) AS money, SUM(IFNULL(busts, 0)) AS busts, COUNT(*) AS reports
FROM \`$PROJECT.$DATASET.$TABLE\` GROUP BY visit;" >/dev/null
"${Q[@]}" query --use_legacy_sql=false --nouse_cache "
CREATE OR REPLACE VIEW \`$PROJECT.$DATASET.daily\` OPTIONS (description = 'Per day (UTC): visits and play time') AS
SELECT DATE(first_seen) AS day, COUNT(*) AS visits, COUNTIF(name IS NOT NULL) AS online_visits, COUNT(DISTINCT name) AS names,
  ROUND(SUM(driving_seconds) / 60) AS minutes_driven, ROUND(AVG(avg_fps), 1) AS avg_fps, SUM(money) AS money, SUM(distance_m) AS distance_m
FROM \`$PROJECT.$DATASET.visits\` GROUP BY day ORDER BY day DESC;" >/dev/null
"${Q[@]}" query --use_legacy_sql=false --nouse_cache "
CREATE OR REPLACE VIEW \`$PROJECT.$DATASET.perf\` OPTIONS (description = 'Per day (UTC) and kind of device: how the game ran') AS
SELECT DATE(ts) AS day, device, gpu, version, auto_lvl, fps_mode, COUNT(DISTINCT visit) AS visits, ROUND(SUM(play_s) / 60, 1) AS minutes,
  ROUND(SAFE_DIVIDE(SUM(fps * play_s), SUM(play_s)), 1) AS avg_fps, ROUND(AVG(fps_slow_ms)) AS avg_slowest_ms, ROUND(AVG(res_pct)) AS avg_res_pct, ROUND(AVG(mem_mb)) AS avg_mem_mb
FROM \`$PROJECT.$DATASET.$TABLE\` WHERE fps IS NOT NULL GROUP BY day, device, gpu, version, auto_lvl, fps_mode;" >/dev/null
"${Q[@]}" query --use_legacy_sql=false --nouse_cache "
CREATE OR REPLACE VIEW \`$PROJECT.$DATASET.missions\` OPTIONS (description = 'Per day (UTC) and mission: started, completed, failed') AS
SELECT DATE(ts) AS day, SPLIT(m, '=')[SAFE_OFFSET(0)] AS mission,
  SUM(SAFE_CAST(SPLIT(SPLIT(m, '=')[SAFE_OFFSET(1)], '.')[SAFE_OFFSET(0)] AS INT64)) AS started,
  SUM(SAFE_CAST(SPLIT(SPLIT(m, '=')[SAFE_OFFSET(1)], '.')[SAFE_OFFSET(1)] AS INT64)) AS completed,
  SUM(SAFE_CAST(SPLIT(SPLIT(m, '=')[SAFE_OFFSET(1)], '.')[SAFE_OFFSET(2)] AS INT64)) AS failed
FROM \`$PROJECT.$DATASET.$TABLE\`, UNNEST(SPLIT(missions, ';')) AS m WHERE missions IS NOT NULL AND m != '' GROUP BY day, mission;" >/dev/null
# the service may append to this one table and nothing else
for i in 1 2 3 4 5 6; do   # a role created a moment ago can take a few seconds to be known to BigQuery
  "${Q[@]}" add-iam-policy-binding --member="serviceAccount:$SA" --role="projects/$PROJECT/roles/$ROLE" "$PROJECT:$DATASET.$TABLE" >/dev/null && break
  [ "$i" = 6 ] && die "could not grant the role on the table"; sleep 10
done

# Cloud Run: smallest practical size, one instance at most and none kept warm, request-based billing (no --no-cpu-throttling), a short timeout, public (the game is the caller; the service checks Origin itself).
"${G[@]}" run deploy "$SERVICE" --source="$HERE" --region="$REGION" --service-account="$SA" --allow-unauthenticated \
  --execution-environment=gen1 --cpu=1 --memory=128Mi --concurrency=1 --min-instances=0 --max-instances=1 --timeout=15 --cpu-throttling \
  --set-env-vars="PROJECT=$PROJECT,DATASET=$DATASET,TABLE=$TABLE,LOCATION=$REGION,ORIGINS=$ORIGINS,DAILY_ROWS=${DAILY_ROWS:-3000},DAILY_REQS=${DAILY_REQS:-20000}"
# Request logs hold the caller's address, so this service's logs are not kept at all.
FILTER="resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$SERVICE\""
"${G[@]}" logging sinks describe _Default --format='value(exclusions.name)' | grep -q "$SERVICE" || "${G[@]}" logging sinks update _Default --add-exclusion="name=$SERVICE,filter=$FILTER,description=play log service: no request logs (they carry addresses)"
if [ -n "$BUDGET" ]; then
  BILLING=$("${G[@]}" billing projects describe "$PROJECT" --format='value(billingAccountName)' | sed 's#billingAccounts/##')
  NUMBER=$("${G[@]}" projects describe "$PROJECT" --format='value(projectNumber)')
  "${G[@]}" billing budgets create --billing-account="$BILLING" --display-name="Palermo Drive play log ${BUDGET} GBP" --budget-amount="${BUDGET}GBP" --filter-projects="projects/$NUMBER" \
    --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0 --notifications-rule-pubsub-topic="projects/$PROJECT/topics/billing-budget-alerts"
  echo "Budget created: past ${BUDGET} GBP the kill switch (relay/killswitch.sh) detaches billing from $PROJECT."
fi
"${G[@]}" run services describe "$SERVICE" --region="$REGION" --format='value(status.url)'
