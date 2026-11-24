#!/bin/zsh
# fetch.sh [run arn]   waits for a Device Farm run (default: the last one started by run.sh) and brings back what each phone kept: into ~/.cache/palermo-drive/devicefarm/<run id>/<phone>/
set -e
export AWS_PROFILE=palermo-drive AWS_DEFAULT_REGION=us-west-2
C=$HOME/.cache/palermo-drive/devicefarm; R=${1:-$(cat $C/last-run-arn.txt)}; D=$C/${R##*/}; mkdir -p $D
while :; do S=$(aws devicefarm get-run --arn $R --query 'run.[status,result,deviceMinutes.total]' --output text); echo "$(date +%H:%M:%S) $S"; [[ $S == COMPLETED* ]] && break; sleep 30; done
aws devicefarm list-jobs --arn $R --query 'jobs[].[arn,device.name,device.os,result,deviceMinutes.total]' --output text | while IFS=$'\t' read -r J NAME OS RES MIN; do
  O="$D/${NAME// /-}-$OS"; mkdir -p $O; echo "$NAME $OS: $RES, $MIN device minutes"
  for T in FILE LOG; do aws devicefarm list-artifacts --arn $J --type $T --query 'artifacts[].[name,extension,url]' --output text | while IFS=$'\t' read -r N E URL; do curl -s -o "$O/${N// /_}.$E" "$URL"; done; done
  ls $O | tr '\n' ' '; echo
done
echo "kept in $D"
