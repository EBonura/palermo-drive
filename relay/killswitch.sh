#!/usr/bin/env bash
# Google's documented "cap costs" pattern (https://cloud.google.com/billing/docs/how-to/disable-billing-with-notifications):
# budget -> Pub/Sub topic -> small Cloud Run function that detaches the billing account from the project.
# WARNING: when it fires, every service in the project stops, free tier included. Re-link billing to restart.
#
#   ./killswitch.sh PROJECT_ID REGION ACCOUNT BILLING_ACCOUNT_ID BUDGET_AMOUNT
#   ./killswitch.sh palermo-drive-123456 europe-west8 bonniestudiosdev@gmail.com 0123AB-456CDE-789FGH 7GBP
#
# BUDGET_AMOUNT is a number with an optional currency code that must match the billing account's currency (5EUR, 5USD, 5).
# The account running this needs Billing Account Administrator on the billing account. Run it once; running it again adds a second budget.
set -euo pipefail
usage() { sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }
die() { echo "error: $*" >&2; exit 1; }

[ $# -eq 5 ] || usage
PROJECT_ID=$1; REGION=$2; ACCOUNT=$3; BILLING=$4; AMOUNT=$5
case "$ACCOUNT" in *@fastly.com) die "refusing to use a work account";; esac
case "$PROJECT_ID" in *csoc*|*fastly*) die "refusing to use what looks like a work project";; esac
CONFIG=palermo-drive
gcloud config configurations list --format='value(name)' 2>/dev/null | grep -qx "$CONFIG" || die "gcloud configuration '$CONFIG' does not exist (DEPLOY.md, step 1)"
export CLOUDSDK_ACTIVE_CONFIG_NAME=$CONFIG
gcloud auth list --format='value(account)' 2>/dev/null | grep -qx "$ACCOUNT" || die "$ACCOUNT is not logged in: gcloud auth login $ACCOUNT"

G=(gcloud "--project=$PROJECT_ID" "--account=$ACCOUNT" --quiet)
HERE=$(cd "$(dirname "$0")" && pwd)
TOPIC=billing-budget-alerts
FN=stop-billing
SA_NAME=billing-killswitch
SA="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

"${G[@]}" services enable billingbudgets.googleapis.com cloudbilling.googleapis.com cloudbuild.googleapis.com cloudfunctions.googleapis.com \
  eventarc.googleapis.com run.googleapis.com pubsub.googleapis.com artifactregistry.googleapis.com
"${G[@]}" pubsub topics describe "$TOPIC" >/dev/null 2>&1 || "${G[@]}" pubsub topics create "$TOPIC"
"${G[@]}" iam service-accounts describe "$SA" >/dev/null 2>&1 || "${G[@]}" iam service-accounts create "$SA_NAME" --display-name="Billing kill switch"

"${G[@]}" functions deploy "$FN" --gen2 --runtime=nodejs22 --region="$REGION" \
  --trigger-topic="$TOPIC" --entry-point=stopBilling --source="$HERE/killswitch" \
  --service-account="$SA" --memory=256Mi --max-instances=1 \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID"

# The trigger delivers budget alerts as this identity, so it must be allowed to call the function: without this every alert is refused and the switch never fires.
"${G[@]}" run services add-iam-policy-binding "$FN" --region="$REGION" --member="serviceAccount:$SA" --role=roles/run.invoker >/dev/null
# The function's identity may detach billing from this project and nothing more (Project Billing Manager on the project, no rights on the billing account).
"${G[@]}" projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA" --role=roles/billing.projectManager --condition=None >/dev/null

NUMBER=$("${G[@]}" projects describe "$PROJECT_ID" --format='value(projectNumber)')
# Alerts by email (to the billing admins) at 50% and 90%; the topic gets every update, the function acts above 100%.
"${G[@]}" billing budgets create --billing-account="$BILLING" --display-name="Palermo Drive $PROJECT_ID" \
  --budget-amount="$AMOUNT" --filter-projects="projects/$NUMBER" \
  --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0 \
  --notifications-rule-pubsub-topic="projects/$PROJECT_ID/topics/$TOPIC"
echo "Kill switch armed: billing is detached from $PROJECT_ID when cost passes $AMOUNT."
echo "Budget data lags by hours, so this is the last line of defence; the relay's own usage cap is the first."
