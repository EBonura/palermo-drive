#!/usr/bin/env bash
# Deploys the Palermo Drive relay to Cloud Run. Idempotent: safe to run again for every update.
#
#   ./deploy.sh PROJECT_ID REGION ACCOUNT
#   ./deploy.sh palermo-drive-123456 us-east1 bonniestudiosdev@gmail.com
#
# All three arguments are required, there is no default project or account. Every gcloud call below passes
# --project and --account explicitly and runs in the dedicated gcloud configuration "palermo-drive" (see DEPLOY.md),
# so the default configuration of this machine is never used or changed.
#
# Optional environment: STATS_KEY (secret for GET /stats?key=..., generated if unset), BUILD=local (build with local
# docker instead of Cloud Build), ORIGINS (allowed Origin hosts, comma separated).
set -euo pipefail

usage() { sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }
die() { echo "error: $*" >&2; exit 1; }

[ $# -eq 3 ] || usage
PROJECT_ID=$1; REGION=$2; ACCOUNT=$3
[ -n "$PROJECT_ID" ] && [ -n "$REGION" ] && [ -n "$ACCOUNT" ] || usage

# Guard rails: never the work account or a work project.
case "$ACCOUNT" in *@fastly.com) die "refusing to use a work account ($ACCOUNT)";; esac
case "$PROJECT_ID" in *csoc*|*fastly*) die "refusing to use what looks like a work project ($PROJECT_ID)";; esac

command -v gcloud >/dev/null || die "gcloud not found"
CONFIG=palermo-drive
gcloud config configurations list --format='value(name)' 2>/dev/null | grep -qx "$CONFIG" \
  || die "gcloud configuration '$CONFIG' does not exist. Create it first (DEPLOY.md, step 1)."
export CLOUDSDK_ACTIVE_CONFIG_NAME=$CONFIG
gcloud auth list --format='value(account)' 2>/dev/null | grep -qx "$ACCOUNT" \
  || die "$ACCOUNT is not logged in. Run: gcloud auth login $ACCOUNT"

G=(gcloud "--project=$PROJECT_ID" "--account=$ACCOUNT" --quiet)
HERE=$(cd "$(dirname "$0")" && pwd)
SERVICE=relay
REPO=palermo
SA_NAME=relay-sa
SA="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/relay:latest"
ORIGINS=${ORIGINS:-ebonura.github.io}
STATS_KEY=${STATS_KEY:-$(openssl rand -hex 16)}
# Cloud Run's free egress allowance (1 GiB) exists only for North American regions: account for it there, ignore it elsewhere.
case "$REGION" in us-*) EGRESS_FREE_MIB=1024;; *) EGRESS_FREE_MIB=0;; esac

echo "== project $PROJECT_ID, region $REGION, account $ACCOUNT"

echo "== enabling APIs (Cloud Run, Artifact Registry, Cloud Build, Firestore)"
"${G[@]}" services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com firestore.googleapis.com iam.googleapis.com

echo "== Artifact Registry repository with a clean-up policy (keeps one small image)"
if ! "${G[@]}" artifacts repositories describe "$REPO" --location="$REGION" >/dev/null 2>&1; then
  "${G[@]}" artifacts repositories create "$REPO" --repository-format=docker --location="$REGION" --description="Palermo Drive relay image"
fi
POLICY=$(mktemp)
cat >"$POLICY" <<'JSON'
[
  { "name": "delete-old-untagged", "action": { "type": "Delete" }, "condition": { "tagState": "untagged", "olderThan": "86400s" } },
  { "name": "keep-latest", "action": { "type": "Keep" }, "condition": { "tagState": "tagged", "tagPrefixes": ["latest"] } }
]
JSON
"${G[@]}" artifacts repositories set-cleanup-policies "$REPO" --location="$REGION" --policy="$POLICY" --no-dry-run
rm -f "$POLICY"

echo "== service account for the relay (only Firestore access)"
if ! "${G[@]}" iam service-accounts describe "$SA" >/dev/null 2>&1; then
  "${G[@]}" iam service-accounts create "$SA_NAME" --display-name="Palermo Drive relay"
fi
"${G[@]}" projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA" --role=roles/datastore.user --condition=None >/dev/null

echo "== Firestore database (free quota: one database per project)"
if ! "${G[@]}" firestore databases describe --database='(default)' >/dev/null 2>&1; then
  "${G[@]}" firestore databases create --database='(default)' --location="$REGION" --type=firestore-native
fi

echo "== building the image"
if [ "${BUILD:-cloud}" = local ]; then
  gcloud auth print-access-token --account="$ACCOUNT" | docker login -u oauth2accesstoken --password-stdin "$REGION-docker.pkg.dev" >/dev/null
  docker buildx build --platform linux/amd64 -t "$IMAGE" --push "$HERE"
else
  "${G[@]}" builds submit "$HERE" --tag "$IMAGE"
fi

echo "== deploying to Cloud Run"
# 1 vCPU (fractional CPU forces concurrency 1), 512 MiB, request-based billing (the default: CPU only while a request,
# including an open WebSocket, is active), never more than one instance so every player shares the same memory,
# scale to zero, requests up to the 60 minute maximum (the relay closes sessions at 55 minutes, clients reconnect).
"${G[@]}" run deploy "$SERVICE" \
  --image="$IMAGE" --region="$REGION" --platform=managed \
  --allow-unauthenticated --ingress=all \
  --service-account="$SA" \
  --cpu=1 --memory=512Mi --concurrency=300 --timeout=3600 \
  --min-instances=0 --max-instances=1 \
  --set-env-vars="^@^STATS_KEY=$STATS_KEY@CPU=1@MEM_GIB=0.5@EGRESS_FREE_MIB=$EGRESS_FREE_MIB@ALLOWED_ORIGINS=$ORIGINS,localhost:*,127.0.0.1:*"

URL=$("${G[@]}" run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')
HOST=${URL#https://}
echo
echo "Deployed: $URL"
echo "  game client:   set RELAY_URL = 'wss://$HOST/ws' in src/net.js"
echo "  stats (HTML):  $URL/stats?key=$STATS_KEY   (add &format=json for JSON; keep this key secret)"
echo "  health:        $URL/healthz"
echo "Next: ./killswitch.sh to add the automatic billing cut-off (DEPLOY.md, step 5)."
