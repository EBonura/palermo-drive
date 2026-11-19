#!/bin/zsh
# batch.sh <draft|wide|tall> <clip>...   shoot several clips of ~/.cache/palermo-drive/film in one format and stack their contact sheets into one picture (review-<format>.jpg)
V=$1; shift; F=$HOME/.cache/palermo-drive/film; M=${0:A:h:h:h}; ins=(); n=0
for c in "$@"; do echo "$c: $($M/tools/film/take.sh $F/$c $V | head -1 | cut -c1-120)"; [ -f $F/$c/sheet-$V.jpg ] && { ins+=(-i $F/$c/sheet-$V.jpg); n=$((n + 1)); }; done
[ $n -gt 1 ] && { fc=""; for i in $(seq 0 $((n - 1))); do fc+="[$i]scale=960:-1[s$i];"; done; for i in $(seq 0 $((n - 1))); do fc+="[s$i]"; done; ffmpeg -v error -y $ins -filter_complex "${fc}vstack=$n" $F/review-$V.jpg </dev/null; }
[ $n -eq 1 ] && cp -f $F/$1/sheet-$V.jpg $F/review-$V.jpg
echo "$F/review-$V.jpg"
