#!/bin/zsh
# run.sh <run name> <device arn>...   packs tools/devicefarm/pkg, uploads it to the Device Farm project and starts one run of the game's ?bench on the phones given.
# Prints the run's ARN; tools/devicefarm/fetch.sh <run arn> waits for it and brings back what each phone measured. Uses the AWS profile palermo-drive (us-west-2) only.
# Every device minute counts against the account (1,000 free once, then $0.17 a minute): the job is cut at 25 minutes a phone.
set -e
export AWS_PROFILE=palermo-drive AWS_DEFAULT_REGION=us-west-2
H=${0:A:h}; C=$HOME/.cache/palermo-drive/devicefarm; P=$(cat $C/project-arn.txt); NAME=$1; shift
(cd $H/pkg && find . -name 'pd-bench-*.tgz' -delete && npm pack --silent >/dev/null && rm -f ../pd-bench.zip && zip -q ../pd-bench.zip pd-bench-*.tgz)
U=$(aws devicefarm create-upload --project-arn $P --name pd-bench.zip --type APPIUM_WEB_NODE_TEST_PACKAGE --query 'upload.[arn,url]' --output text)
UA=${U%%$'\t'*}; curl -s -T $H/pd-bench.zip "${U#*$'\t'}"
for i in {1..40}; do S=$(aws devicefarm get-upload --arn $UA --query upload.status --output text); [ $S = SUCCEEDED ] && break; [ $S = FAILED ] && { aws devicefarm get-upload --arn $UA --query upload.metadata --output text; exit 1; }; sleep 3; done
V=$(aws devicefarm create-upload --project-arn $P --name pd-spec.yml --type APPIUM_WEB_NODE_TEST_SPEC --query 'upload.[arn,url]' --output text)   # spec.yml: AWS's sample recipe with our test command (the sample itself is refused as is)
SPEC=${V%%$'\t'*}; curl -s -T $H/spec.yml "${V#*$'\t'}"
for i in {1..40}; do S=$(aws devicefarm get-upload --arn $SPEC --query upload.status --output text); [ $S = SUCCEEDED ] && break; [ $S = FAILED ] && { aws devicefarm get-upload --arn $SPEC --query upload.metadata --output text; exit 1; }; sleep 3; done
ARNS=$(printf '\\"%s\\",' "$@"); ARNS=${ARNS%,}
POOL=$(aws devicefarm create-device-pool --project-arn $P --name "$NAME" --rules "[{\"attribute\":\"ARN\",\"operator\":\"IN\",\"value\":\"[$ARNS]\"}]" --query devicePool.arn --output text)
aws devicefarm schedule-run --project-arn $P --device-pool-arn $POOL --name "$NAME" --test "type=APPIUM_WEB_NODE,testPackageArn=$UA,testSpecArn=$SPEC" --execution-configuration jobTimeoutMinutes=25 --query run.arn --output text | tee $C/last-run-arn.txt
